const restify = require('restify');

function serve() {
  let server = restify.createServer();
  let qp = restify.queryParser({ mapParams: false });
  server.get('/log', qp, (req: any, res: any, next: any) => {
    console.log(req.query['msg']);
  });
  server.listen(4700, () => {
    console.log("listening on %s", server.url);
  });
}

serve();
