// @ts-check
const Augur = require("augurbot-ts");
const config = require("../config/config.json");
const { createServer } = require("http");
const u = require("../utils/utils");

/** @type {ReturnType<import("express")>} */
let app;

/** @type {ReturnType<createServer>} */
let httpServer;

/** @type {import("socket.io").Server} */
let io;

if (config.siteOn) {
  // require modules!
  // @ts-ignore
  require("../site/backend/utils/strategy");
  // @ts-ignore
  const siteConfig = require("../config/siteConfig.json");
  const passport = require("passport");
  const express = require("express");
  const session = require("express-session");
  const mongoose = require("mongoose");
  const cors = require("cors");
  const Store = require("connect-mongo");
  const { Server } = require("socket.io");

  // @ts-ignore
  const routes = require("../site/backend/routes");

  // @ts-ignore
  const tourneyWS = require('../site/backend/routes/tournament/WS');
  // @ts-ignore
  const streamingWS = require("../site/backend/routes/streaming/ws");

  app = express();
  const socket = require("express-ws")(app);

  // encoders

  const globalLimit = require("express-rate-limit").rateLimit({
    limit: 5,
    windowMs: 3_000,
    message: { msg: "You're going too fast! Slow down!" },
    // @ts-ignore
    skip: (r) => r.url.startsWith("/streaming") && Boolean(r.user) && u.perms.calc(r.user, ["team"])
  });

  app.use(express.json())
    .disable("x-powered-by")
    .set("trust proxy", siteConfig.deployBuild ? 1 : 0)
    .use(express.urlencoded({ extended: false }))
    .use(cors({
      origin: siteConfig.allowedCorsOrigins,
      credentials: true,
    }))
    .use((req, res, next) => {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("X-Frame-Options", "DENY");
      // res.setHeader("Content-Security-Policy", siteConfig.cspHeaders.join(""));
      next();
    });

  app.use('/static', express.static('site/backend/public', { setHeaders: (res, path) => {
    // we want these to be direct downloads
    if (path.includes("wallpapers")) {
      res.setHeader("Content-Disposition", "attachment");
    }
    res.setHeader("Cache-Control", "public, max-age=259200");
    return res;
  } }));

  // token storage setup
  const sessionMiddleware = session({
    secret: siteConfig.sessionSecret,
    cookie: {
      maxAge: 60000 * 60 * 24 * siteConfig.maxCookieDays,
      secure: siteConfig.deployBuild,
      httpOnly: true,
      sameSite: "strict"
    },
    resave: false,
    saveUninitialized: false,
    store: Store.create({
      // @ts-expect-error
      client: mongoose.connection.getClient(),
    })
  });

  app.use(sessionMiddleware);

  app.use(passport.initialize())
    .use(passport.session());

  // expose backend routes
  app.use('/api', globalLimit, (req, res, next) => {
    if (siteConfig.monitoring) {
      if (!(req.path.startsWith("/streaming/overlay") && !req.path.endsWith(".html"))) {
        // @ts-ignore sometimes it picks on some nonsense
        // eslint-disable-next-line no-console
        console.log(`${req.user?.displayName ?? "Unauthorized User"} [${req.method}] ${req.path}`);
      }
    }
    next();
  }, routes);

  // not quite ready, waiting for tag migration
  // app.use('/tags', express.static('media/tags'));

  // Handle all other routes by serving the React index.html file
  if (siteConfig.deployBuild) {
    const path = require("path");
    const frontFiles = path.resolve(__dirname, '../site/frontend/build');

    // Serve static files from the React build folder
    app.use(express.static("site/frontend/build"));
    app.get('*', (req, res) => {
      res.sendFile(frontFiles + "/index.html");
    });
  }

  if (siteConfig.tournamentReady) {
    // tournament websocket handler
    socket.app.ws("/ws/tournaments/:id/listen", (ws, req) => {
      tourneyWS.listen(ws, req);
    });
  }

  httpServer = createServer(app);
  io = new Server(httpServer, { path: "/ws/streams" });

  /**
   * @param {import("express").Handler} middleware
   * @returns {import("express").Handler}
   */
  const onlyForHandshake = (middleware) => {
    return (req, res, next) => {
      // @ts-ignore
      const isHandshake = req._query.sid === undefined;
      if (isHandshake) {
        middleware(req, res, next);
      } else {
        next();
      }
    };
  };

  io.engine.use(onlyForHandshake(sessionMiddleware));
  io.engine.use(onlyForHandshake(passport.session()));
  io.engine.use(onlyForHandshake((req, res, next) => {
    if (req.user) {
      next();
    } else {
      res.writeHead(401);
      res.end();
    }

  }));

  io.on("connection", streamingWS.listen);

  // eslint-disable-next-line no-console
  httpServer.listen(siteConfig.port, () => console.log(`Site running on port ${siteConfig.port}`));
}

module.exports = new Augur.Module()
.setUnload(() => {
  if (!config.siteOn) return;

  httpServer?.close();
  io.disconnectSockets();

  delete require.cache[require.resolve("../config/siteConfig.json")];
  delete require.cache[require.resolve("../data/site/daedalus-q.js")];
  delete require.cache[require.resolve("../data/site/lore-found.json")];

  const fs = require("fs");
  const routes = fs.readdirSync("./site/backend/routes", { recursive: true, encoding: "utf8" });
  const wu = fs.readdirSync("./site/backend/utils");

  for (const route of routes) {
    if (!route.endsWith(".js") && !route.endsWith(".json")) continue;
    delete require.cache[require.resolve(`../site/backend/routes/${route}`)];
  }

  for (const file of wu) {
    delete require.cache[require.resolve(`../site/backend/utils/${file}`)];
  }

});