ClaferIDE
=========

##### v0.4.4

A web-based IDE for Clafer.

ClaferIDE is part of Clafer Tools.
Read more in the paper [Clafer Tools for Product Line Engineering](http://gsd.uwaterloo.ca/publications/view/519).

### Live demo

* Master branch (stable and released): [ClaferIDE](http://t3-necsis.cs.uwaterloo.ca:8094/)
* Develop branch (with latest features, but may be unstable): [ClaferIDE (development)](http://t3-necsis.cs.uwaterloo.ca:8194/)

If the demo is down or you encounter a bug, please email [Michał Antkiewicz](mailto:mantkiew@gsd.uwaterloo.ca).

### Background

See [clafer.org](http://clafer.org).

### Functions

* Provides a web-based IDE for modeling in Clafer.
* Provides an source code editor (ACE).
* Compiles the model to HTML for syntax highlighting and navigation via hyperlinks or error highlighting.
* Instantiates the model using ClaferIG and allows for global scope setting and requesting a next instance.
* Provides a set of predefined examples that can be compiled and instantiated.

### Nature

ClaferIDE is a web-based application.
Its server side (implemented with `Node.js`) processes requests, runs the chosen back-end and passes back its output.
The client-side is implemented using `JavaScript/HTML` and handles all the IDE functionality.

Contributors
------------

* [Alexandr Murashkin](http://gsd.uwaterloo.ca/amurashk). Original developer.
* [Michał Antkiewicz](http://gsd.uwaterloo.ca/mantkiew). Research Engineer. Requirements, development, architecture, testing, technology transfer.
* [Eldar Khalilov](http://gsd.uwaterloo.ca/ekhalilov). Developer. Upgrade to 0.4.2 (replace XML with JSON, test suites).

Installation and running
------------------------

### Dependencies for running

* [Java Platform (JDK)](http://www.oracle.com/technetwork/java/javase/downloads/index.html) v8+
* [Clafer](https://github.com/gsdlab/clafer) v0.4.4
  * can be from the binary distribution
* [Node.js Framework](http://nodejs.org/download/), v4.2.3 LTS
* [Redis Server](https://launchpad.net/~chris-lea/+archive/ubuntu/redis-server), v2:2.*
  * On Ubuntu, execute `sudo add-apt-repository ppa:chris-lea/redis-server && apt-get install redis-server`
* Backends' dependencies must be satisfied. See the backend installation steps below.

### Installation

**Core**

1. Download (`git clone`) [ClaferIDE](https://github.com/gsdlab/ClaferIDE) to some directory `<target directory>`
2. Go to `<target directory>/ClaferIDE` and execute

```
git submodule init
git submodule update
```

This will install the platform.

When working with a branch other then `master`, you need to additionally checkout that branch (e.g., `develop`):

```
git submodule foreach git checkout develop
```

3. Go to `<target directory>/ClaferIDE/Server` and execute

`npm install`

This will download all the required `Node.js` modules.

4. Install the necessary backends into some location `<bin>` found on `PATH`. The default configuration in `<target directory>/ClaferIDE/Server/Backends/backends.json` assumes `/home/clafertools040/bin`.

The fastest way is to unzip a binary distribution into the folder `<bin>`.

See [Installing Backends](https://github.com/gsdlab/ClaferToolsUICommonPlatform#backends) for detailed steps.

### Settings

1. Make sure the port `8094` is free, or change the value of the key `port` in `Server/config.json`:
`"port" = "8094"` to any free one.

2. Make sure `clafer`, `node`, and `java` are in `PATH` environment variables, so they can be executed without any path prefixes.

3. Running the following commands should produce the following results or later version:

`clafer --version`

> `Clafer v0.4.4`

`claferIG --version`

> `Clafer v0.4.4`

`java -version`

> `java version 1.8.0_102`

`node -v`

> `v4.2.3 LTS`

4. Make sure `uploads` folder is accessible for writing, since temporary files will be stored there.

5. If you use Shell scipts (`.sh`) for running, make sure the scripts have `Execute` permissions.

### Running

* To run the server in a standard mode, execute

```sh
cd <target directory>/ClaferIDE/Server/
node ClaferIDE.js
```

* If you use `Node Supervisor` under Linux, you can execute

```sh
cd <target directory>/ClaferIDE/Server/commons
chmod +x start.sh
./start.sh
```

Then you can go to any browser and type `http://localhost:[port]/` and open any Clafer file with objectives in it.

### Trying an Example

* Choose `Simple model of a Person` example in the dropdown box in the upper-left corner of the tool window.
* Press `Compile` button right in the front of the drop down list.
* Once you see the compilation is complete, go to `Instance Generator` view and press `Run` there (the default backend is `Alloy-based IG (IG only)`).
* The `Output` view should print the first generated instance.

### Important: Branches must correspond

All related projects are following the *simultaneous release model*.
The branch `master` contains releases, whereas the branch `develop` contains code under development.
When building the tools, the branches should match.
Releases from branches `master` are guaranteed to work well together.
Development versions from branches `develop` should work well together but this might not always be the case.

Need help?
==========

* Visit [language's website](http://clafer.org).
* Report issues to [issue tracker](https://github.com/gsdlab/ClaferIDE/issues)
