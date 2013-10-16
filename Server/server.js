/*
Copyright (C) 2012, 2013 Alexander Murashkin, Neil Redman <http://gsd.uwaterloo.ca>

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
of the Software, and to permit persons to whom the Software is furnished to do
so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
var http = require("http");
var url = require("url");
var sys = require("sys");
var fs = require("fs");
var path = require('path');
var express = require('express');
var config = require('./config.json');
var crypto = require('crypto'); // for getting hashes

//var tool_path = __dirname + "/ClaferMoo/spl_datagenerator/";
//var python_file_name = "IntegratedFeatureModelOptimizer.py";
//var pythonPath = config.pythonPath;


var port = config.port;

var server = express();

//support for sessions - used for url uploads
server.use(express.cookieParser('asasdhf89adfhj0dfjask'));
var store = new express.session.MemoryStore;
server.use(express.session({secret: 'supersecretstring', store: store}));

server.use(express.static(__dirname + '/Client'));
server.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + '/uploads' }));

var URLs = [];
var processes = [];

server.get('/Examples/:file', function(req, res) {
    res.sendfile('Examples/' + req.params.file);
});

server.get('/', function(req, res) {
//uploads now and runs once app.html is fully loaded
//works because client currently sends one empty post upon completion of loading
	if (req.query.claferFileURL) {
		var sessionURL = new Object
		sessionURL.session = req.sessionID;
		sessionURL.url = req.query.claferFileURL;
		URLs.push(sessionURL);
		console.log(req.sessionID);
	}
    res.sendfile("Client/app.html");
});

server.get('/htmlwrapper', function(req, res) {
    res.sendfile("Client/compiler_html_wrapper.html");
});

/*
 * Handle Clientside save requests
 */
server.post('/', function(req, res, next) {
	console.log("returning instances.cfr.data file");
   	res.writeHead(200, { "Content-Type": "text/html",
   						 "Content-Disposition": "attachment; filename=Instances.cfr.data"});
	res.end(req.body.data);
});

/*
 * Handle Polling
 * The client will poll the server to get the latest updates or the final result
 * Polling is implemented to solve the browser timeout problem.
 * Moreover, this helps to control the execution of ClaferMoo: to stop, or to get intermediate results.
 * An alternative way might be to create a web socket
 */

server.post('/poll', function(req, res, next)
{
    var found = true;
    for (var i = 0; i < processes.length; i++)
    {
        if (processes[i].windowKey == req.body.windowKey)
        {
            if (req.body.command == "ping") // normal ping
            {                
                clearTimeout(processes[i].pingTimeoutObject);
                processes[i].pingTimeoutObject = setTimeout(function(process){
                    process.result = '{"message": "' + escapeJSON('Error: Ping Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.pingTimeout + ' millisecond(s).') + '"}';
                    process.code = 9004;
                    process.completed = true;
                    process.pingTimeout = true;
                    killProcessTree(process);
                }, config.pingTimeout, processes[i]);
                
                if (processes[i].completed) // the execution is completed
                {
                    
                    if (processes[i].code == 0)
                    {
                        res.writeHead(200, { "Content-Type": "application/json"});
                    }
                    else
                    {
                        res.writeHead(400, { "Content-Type": "application/json"});
                    }

                    res.end(processes[i].result);
                    if (processes[i].pingTimeoutObject)
                    {
                        clearTimeout(processes[i].pingTimeoutObject);
                        clearTimeout(processes[i].executionTimeoutObject);                    
                    }
                    processes.splice(i, 1);
                    found = true;
                }	
                else // still working
                {
                    res.writeHead(200, { "Content-Type": "application/json"});
                    res.end('{"message": "Working"}');
                    found = true;
                }
            }
            else // if it is cancel
            {
                killProcessTree(processes[i]);
                clearTimeout(processes[i].pingTimeoutObject);                
                clearTimeout(processes[i].executionTimeoutObject);
                processes.splice(i, 1);
                res.writeHead(200, { "Content-Type": "application/json"});
                res.end('{"message": "Cancelled"}');
                found = true;
            }
        }
        
    }
    
    var i = 0;
    while (i < processes.length)
    {
        if (processes[i].pingTimeout)
        {
            clearTimeout(processes[i].pingTimeoutObject);
            clearTimeout(processes[i].executionTimeoutObject);                    
            processes.splice(i, 1);
        }
        else
            i++;
    }
    
    if (!found)
    {
        res.writeHead(404, { "Content-Type": "text/html"});
        res.end("Error: the requested process is not found.");
    }
});

/*
 * Handle file upload
 */
server.post('/upload', function(req, res, next) 
{
	console.log("---------------------------");
	console.log("/Upload request initiated.");

    var key = req.body.windowKey;
    var currentURL = "";
    
    var uploadedFilePath = "";
    
	//check if client has either a file directly uploaded or a url location of a file
   	
    if (req.body.exampleFlag == "1")
    {
        if (req.body.exampleURL !== undefined && req.body.exampleURL !== "") // if example submitted
        {
            console.log(req.headers.host);
            currentURL = "http://" + req.headers.host + "/Examples/" + req.body.exampleURL;                
        }
        else
        {
            console.log("No example submitted. Returning...");
            res.writeHead(200, { "Content-Type": "text/html"});
            res.end("no clafer file submitted");
            return;
        }		
	} 
    else 
    {    
        // first, check for the URL clafer file name. It happens only on clafer file submit, not the example file submit
        var found = false;
        for (var x = 0; x < URLs.length; x++)
        {
            if (URLs[x].session === req.sessionID && ("claferFileURL=" + URLs[x].url) === url.parse(req.body.claferFileURL).query)
            {
                currentURL = URLs[x].url;
                URLs.splice(x,1);
                found = true;
                break;
            }
        }
    
        if (!found) // if no URL was submitted
        {
            // then we have a series of checks, whether the file is submitted, exists, and non-empty
            if (!req.files.claferFile)
            {
                console.log("No clafer file submitted. Returning...");
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;        
            }
        
            uploadedFilePath = req.files.claferFile.path;
            if (!fs.existsSync(uploadedFilePath))
            {
                console.log("No Clafer file submitted. Returning...");
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;
            }
            var pre_content = fs.readFileSync(uploadedFilePath);
            if (pre_content.length == 0)
            {
                console.log("No Clafer file submitted. Returning...");
                res.writeHead(200, { "Content-Type": "text/html"});
                res.end("no clafer file submitted");
                return;
            }        
        }
	}
    
/* downloading the file, if required */ 

    if (currentURL != "")
    {

        var i = 0;
        uploadedFilePath = req.sessionID;
        uploadedFilePath = uploadedFilePath.replace(/[\/\\]/g, "");
        uploadedFilePath = __dirname + "/uploads/" + uploadedFilePath;
        while(fs.existsSync(uploadedFilePath + i.toString() + ".cfr")){
            i = i+1;
        }
        uploadedFilePath = uploadedFilePath + i.toString() + ".cfr";
        
        console.log('Downloading file at "' + currentURL + '"...');
        var file = fs.createWriteStream(uploadedFilePath);
        http.get(currentURL, function(httpRes){
            httpRes.on('data', function (data) {
                file.write(data);
            }).on('end', function(){
                file.end();
                console.log("File downloaded to ./uploads");
                fileReady();
            });
        });
    }
    else
        fileReady();
                
    function fileReady()
    {
                    
        var i = 0;
    //    console.log(resp);
        while(fs.existsSync("./uploads/" + i + "tempfolder/")){
            i++;
        }
        console.log("Uploaded file: " + uploadedFilePath);
        var pathTokens = "." + uploadedFilePath.split("Server")[1];
        console.log("Partial path: " + pathTokens);
        
        var pathTokensLinux = pathTokens.split("/");
        var pathTokensWindows = pathTokens.split("\\");
        
        if (pathTokensWindows.length > pathTokensLinux.length)
            pathTokens = pathTokensWindows;
        else    
            pathTokens = pathTokensLinux;
        
        console.log('Path tokens: "' + pathTokens.join('; ') + '"');
        var oldPath = uploadedFilePath;
        uploadedFilePath = __dirname + "/" + pathTokens[1] + "/" + i + "tempfolder/"; // this slash will work anyways
        fs.mkdir(uploadedFilePath, function (err){
            if (err) throw err;
            var dlDir = uploadedFilePath;
            uploadedFilePath += pathTokens[2];
            fs.rename(oldPath, uploadedFilePath, function (err){
                if (err) throw err;
                console.log("Proceeding with " + uploadedFilePath);
                
                // read the contents of the uploaded file
                fs.readFile(uploadedFilePath, function (err, data) {

                    var file_contents;
                    if(data)
                        file_contents = data.toString();
                    else
                    {
                        res.writeHead(500, { "Content-Type": "text/html"});
                        res.end("No data has been read");
                        cleanupOldFiles(uploadedFilePath, dlDir);
                        return;
                    }
                    
                    console.log("Compiling...");

                    var process = { windowKey: key, tool: null, folder: dlDir, path: uploadedFilePath, completed: false, code: 0, killed:false, contents: file_contents};

                    var clafer_compiler  = spawn("clafer", ["--mode=HTML", "--self-contained", uploadedFilePath]);
                    clafer_compiler.on('error', function (err){
                        console.log('ERROR: Cannot find Clafer Compiler (clafer). Please check whether it is installed and accessible.');
                        res.writeHead(400, { "Content-Type": "text/html"});
                        res.end("error");
                    });
                    
                    clafer_compiler.on('exit', function (code){	
                            // read the contents of the compiled file
                            fs.readFile(changeFileExt(uploadedFilePath, '.cfr', '.html'), function (err, html) 
                            {
                                if (err)
                                {
                                    console.log('ERROR: Cannot read the compiled HTML file.');
                                    res.writeHead(400, { "Content-Type": "text/html"});
                                    res.end("compile_error");
                                    process.result = '{"message": "' + escapeJSON("Error: Compilation Error") + '"}';
                                    process.code = 0;
                                    process.completed = true;
                                    process.tool = null;
                                    processes.push(process);           
                                    cleanupOldFiles(uploadedFilePath, dlDir); // cleaning up when cached result is found
                                    return;
                                }
                                else
                                {
                                    res.writeHead(200, { "Content-Type": "text/html"});
                                    res.end(html);

                                    if (code != 0)
                                    {
                                        process.result = '{"message": "' + escapeJSON("Error: Compilation Error") + '"}';
                                        process.code = 0;
                                        process.completed = true;
                                        process.tool = null;
                                        processes.push(process);           
                                        cleanupOldFiles(uploadedFilePath, dlDir); // cleaning up when cached result is found
                                        return;
                                    }
                                    else
                                    {
                                        process.result = '{"message": "' + escapeJSON("Successfully Compiled") + '"}';
                                        process.code = 0;
                                        process.completed = true;
                                        process.tool = null;
                                        processes.push(process);           
                                        cleanupOldFiles(uploadedFilePath, dlDir); // cleaning up when cached result is found
                                        return;
                                    }
                                }
                            });

/* Consider Adding this functionality later:

                                    process.executionTimeoutObject = setTimeout(function(process){
                                        console.log("Request timed out.");
                                        process.result = '{"message": "' + escapeJSON('Error: Execution Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.executionTimeout + ' millisecond(s).') + '"}';
                                        process.code = 9003;
                                        process.completed = true;
                                        killProcessTree(process);
                                    }, config.executionTimeout, process);
                                    
                                    process.pingTimeoutObject = setTimeout(function(process){
                                        process.result = '{"message": "' + escapeJSON('Error: Ping Timeout. Please consider increasing timeout values in the "config.json" file. Currently it equals ' + config.pingTimeout + ' millisecond(s).') + '"}';
                                        process.code = 9004;
                                        process.completed = true;
                                        process.pingTimeout = true;
                                        killProcessTree(process);
                                    }, config.pingTimeout, process);

                                        clearTimeout(process.timeoutObject);
*/                                        
                    });
                    
                });
            });
        });
    }
});

function finishCleanup(dir, results){
	if (fs.existsSync(dir)){
		fs.rmdir(dir, function (err) {
  			if (err) throw err;
 			console.log("Successfully deleted " + dir + " along with contents:\n" + results);
		});
	}
}
 
function cleanupOldFiles(path, dir) {
    console.log("Cleaning temporary files...");                    
	//cleanup old files
	fs.readdir(dir, function(err, files){
		if (err) throw err;
		var results = "";
		var numFiles = files.length;
		console.log("#Files = " + numFiles);
		if (!numFiles){
			return finishCleanup(dir, results);
		} else {
			files.forEach(function(file){
				deleteOld(dir + "/" + file);
				results += file + "\n";
			});	
			finishCleanup(dir, results);
		}
	});


//done cleanup
}

function deleteOld(path){
	if (fs.existsSync(path)){
		fs.unlinkSync(path, function (err) { // added Sync to make sure all files are properly removed until the removal of the directory
			if (err) throw err;
		});
	}
}

function escapeJSON(unsafe) 
{
    return unsafe.replace(/[\\]/g, '\\\\')
        .replace(/[\"]/g, '\\\"')
        .replace(/[\/]/g, '\\/')
        .replace(/[\b]/g, '\\b')
        .replace(/[\f]/g, '\\f')
        .replace(/[\n]/g, '\\n')
        .replace(/[\r]/g, '\\r')
        .replace(/[\t]/g, '\\t');
}

function changeFileExt(name, ext, newExt)
{
	var ending = name.toLowerCase().substring(name.length - 4);
	if (ending == ext.toLowerCase())
		return name.substring(0, name.length - 4) + newExt;

	return name;
}

function killProcessTree(process)
{
    var spawn = require('child_process').spawn;
    console.log("Killing the process tree with Parent PID = " + process.tool.pid);
    
    process.killed = true;
    
    if (process.tool)
    {
    
        // first, try a Windows command
        var killer_win  = spawn("taskkill", ["/F", "/T", "/PID", process.tool.pid]);
        
        killer_win.on('error', function (err){	// if error occurs, then we are on Linux
            var killer_linux = spawn("pkill", ["-TERM", "-P", process.tool.pid]);                   

            killer_linux.on('error', function(err){
                console.log("Cannot terminate processes.");
            });
        });                
    }
                
}


/*
 * Catch all. error reporting for unknown routes
 */
server.use(function(req, res, next){

    console.log(req.url);
    
    if (req.url.substring(0, "/Examples/".length) == "/Examples/") // allow only Examples folder
    {
        res.sendFile(req.url.substring(1));
    }
    else
        res.send(404, "Sorry can't find that!");
});

var dependency_count = 2; // the number of tools to be checked before the Visualizer starts
console.log('===============================');
console.log('| ClaferIDE v0.3.5.??-??-???? |');
console.log('===============================');
var spawn = require('child_process').spawn;
console.log('Checking dependencies...');

var clafer_compiler  = spawn("clafer", ["-V"]);
var clafer_compiler_version = "";
clafer_compiler.on('error', function (err){
    console.log('ERROR: Cannot find Clafer Compiler (clafer). Please check whether it is installed and accessible.');
});
clafer_compiler.stdout.on('data', function (data){	
    clafer_compiler_version += data;
});
clafer_compiler.on('exit', function (code){	
    console.log(clafer_compiler_version.trim());
    if (code == 0) dependency_ok();
});

var java  = spawn("java", ["-version"]);
var java_version = "";
java.on('error', function (err){
    console.log('ERROR: Cannot find Java (java). Please check whether it is installed and accessible.');
});
java.stdout.on('data', function (data){	
    java_version += data;
});
java.stderr.on('data', function (data){	
    java_version += data;
});
java.on('exit', function (code){	
    console.log(java_version.trim());
    if (code == 0) dependency_ok();
});

/* uncommented this check, since we have many backends now 
var claferMoo  = spawn(pythonPath, [tool_path + python_file_name, "--version"]);
var claferMoo_version = "";
// 'error' would mean that there is no python, which has been checked already
claferMoo.on('error', function (err){
    console.log('ERROR: Cannot run ClaferMoo (' + tool_path + python_file_name + '). Please check whether it is installed and accessible.');
});
claferMoo.stdout.on('data', function (data){	
    claferMoo_version += data;
});
claferMoo.stderr.on('data', function (data){	
    claferMoo_version += data;
});
claferMoo.on('exit', function (code){	
    if (code != 0)
        console.log('ERROR: Cannot run ClaferMoo (' + tool_path + python_file_name + '). Please check whether it is installed and accessible.');
    
    console.log(claferMoo_version.trim());
    if (code == 0) dependency_ok();
});
*/
var node_version = process.version + ", " + JSON.stringify(process.versions);
console.log("Node.JS: " + node_version);

function dependency_ok()
{
    dependency_count--;
    if (dependency_count == 0)
    {
        server.listen(port);
        console.log('Dependencies found successfully. Please review their versions manually');        
        console.log('======================================');
        console.log('Ready. Listening on port ' + port);        
    }
}