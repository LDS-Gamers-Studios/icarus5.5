// @ts-check
const Augur = require("augurbot-ts");
const config = require("../config/config.json");

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

  // @ts-ignore
  const routes = require("../site/backend/routes");

  // @ts-ignore
  const tourneyWS = require('../site/backend/routes/tournament/WS');

  const app = express();
  const socket = require("express-ws")(app);

  // encoders

  const globalLimit = require("express-rate-limit").rateLimit({
    limit: 5,
    windowMs: 3_000,
    message: { msg: "You're going too fast! Slow down!" }
  });

  app.use(express.json())
    .use(express.urlencoded({ extended: false }))
    .use(cors({
      origin: siteConfig.allowedCorsOrigins,
      credentials: true,
    }))
    .use((req, res, next) => {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      // res.setHeader("Content-Security-Policy", siteConfig.cspHeaders.join("");
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
  app.use(session({
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
  }));

  app.use(passport.initialize())
    .use(passport.session());

  // expose backend routes
  app.use('/api', globalLimit, (req, res, next) => {
    // eslint-disable-next-line no-console
    if (config.devMode) console.log("request inbound!");
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

  // eslint-disable-next-line no-console
  app.listen(siteConfig.port, () => console.log(`Site running on port ${siteConfig.port}`));
}

module.exports = new Augur.Module();