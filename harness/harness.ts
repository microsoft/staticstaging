const restify = require('restify');
const open_url = require('open');
const querystring = require('querystring');
const fs = require('fs');

/**
 * Read a file to a string.
 */
function read_string(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, function (err: any, data: any) {
      if (err) {
        reject(err);
      } else {
        resolve(data.toString());
      }
    });
  });
}

/**
 * Start the server and return its URL.
 */
function serve(log: (msg: any) => void): Promise<string> {
  let server = restify.createServer();
  let qp = restify.queryParser({ mapParams: false });

  // Log messages to a file.
  server.get('/log', qp, (req: any, res: any, next: any) => {
    log(JSON.parse(req.query['msg']));
    res.send('done');
    next();
  });

  // Serve the main HTML and JS files.
  server.get('/', restify.serveStatic({
    // `directory: '.'` appears to be broken:
    // https://github.com/restify/node-restify/issues/549
    directory: '../harness',
    file: 'index.html',
  }));
  server.get('/client.js', restify.serveStatic({
    directory: './build',
    file: 'client.js',
  }));

  // Serve the dingus assets.
  server.get(/\/.*/, restify.serveStatic({
    directory: '../dingus',
    default: 'index.html',
  }));

  // Start the server.
  let port = 4700;
  let url = "http://localhost:" + port;
  return new Promise((resolve, reject) => {
    server.listen(port, () => {
      resolve(url);
    });
  });
}

function main() {
  // Execute a program.
  let fn = process.argv[2];
  let code: string;
  console.log("executing " + fn);
  read_string(fn).then((code) => {
    // Handler for logged messages.
    let log = (msg: any) => {
      console.log("got!", msg);
    };

    serve(log).then((url) => {
      console.log(url);

      // Open the program in the browser.
      if (code) {
        let query = querystring.stringify({ code });
        open_url(url + '/#' + query);
      }
    });
  });
}

main();
