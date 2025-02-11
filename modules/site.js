// @ts-check
const Augur = require("augurbot-ts");
const config = require("../config/config.json");

if (config.siteOn) {
  // require modules!
  require("../site/backend/utils/strategy");
  const siteConfig = require("../config/siteConfig.json");
  const passport = require("passport");
  const express = require("express");
  const session = require("express-session");
  const mongoose = require("mongoose");
  const cors = require("cors");
  const Store = require("connect-mongo");
  const routes = require("../site/backend/routes");
  const tourneyWS = require('../site/backend/routes/tournament/WS');
  const socket = require("express-ws")(express());
  const app = socket.app;

  // encoders
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cors({
    origin: [siteConfig.frontend],
    credentials: true,
  }));

  // token storage setup
  app.use(session({
    secret: siteConfig.sessionSecret,
    cookie: { maxAge: 60000 * 60 * 24 * 3 },
    resave: false,
    saveUninitialized: false,
    store: Store.create({
      // @ts-expect-error
      client: mongoose.connection.getClient()
    })
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // expose routes
  app.use('/api', routes);
  app.use('/static', express.static('site/backend/public', { setHeaders: (res, path) => {
    // we want these to be direct downloads
    if (path.includes("wallpapers")) {
      res.setHeader("Content-Disposition", "attachment");
    }
    return res;
  } }));

  const readyToDeploy = false;

  // app.use('/tags', express.static('media/tags'));

  // Handle all other routes by serving the React index.html file
  if (readyToDeploy) {
    const path = require("path");
    const frontFiles = path.resolve(__dirname, '../site/frontend/build');

    // Serve static files from the React build folder
    app.use(express.static("site/frontend/build"));
    app.get('*', (req, res) => {
      res.sendFile(frontFiles + "/index.html");
    });
  }
  // eslint-disable-next-line no-console
  app.listen(siteConfig.port, () => console.log(`Site running on port ${siteConfig.port}`));

  // tournament websocket handler
  app.ws("/ws/tournaments/:id/listen", (ws, req) => {
    tourneyWS.listen(ws, req);
  });

}

module.exports = new Augur.Module();