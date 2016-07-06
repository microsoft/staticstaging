const restify = require('restify');

function serve() {
  let server = restify.createServer();
  let qp = restify.queryParser({ mapParams: false });

  // Log messages to a file.
  server.get('/log', qp, (req: any, res: any, next: any) => {
    console.log(req.query['msg']);
    res.send('done');
    next();
  });

  // Serve the main HTML file.
  server.get('/', restify.serveStatic({
    // `directory: '.'` appears to be broken:
    // https://github.com/restify/node-restify/issues/549
    directory: '../harness',
    file: 'index.html',
  }));

  // Serve the dingus assets.
  server.get(/\/.*/, restify.serveStatic({
    directory: '../dingus',
    default: 'index.html',
  }));

  server.listen(4700, () => {
    console.log("listening on %s", server.url);
  });
}

serve();
