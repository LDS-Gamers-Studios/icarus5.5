// @ts-check
const Augur = require("augurbot-ts");
const config = require("../config/config.json");

if (config.siteOn) {
  require("../site/backend/utils/strategy");
  const siteConfig = require("../config/siteConfig.json");
  const passport = require("passport");
  const express = require("express");
  const session = require("express-session");
  const mongoose = require("mongoose");
  const cors = require("cors");
  const Store = require("connect-mongo");
  const routes = require("../site/backend/routes");

  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cors({
    origin: [siteConfig.frontend],
    credentials: true,
  }));

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

  app.use('/api', routes);
  app.use('/static', express.static('site/backend/public'));
  // app.use('/tags', express.static('media/tags'));

  // eslint-disable-next-line no-console
  app.listen(siteConfig.port, () => console.log(`Backend running on port ${siteConfig.port}`));
}

module.exports = new Augur.Module();