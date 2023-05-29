const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const jsonMiddleware = express.json();
app.use(jsonMiddleware);

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

// User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
    SELECT
      *
    FROM
      user
    WHERE 
      username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET States API
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT
      state_id AS stateId,
      state_name AS stateName,
      population
    FROM
      state
    ORDER BY
      state_id;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

//GET StatesById API
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
    SELECT
      state_id AS stateId,
      state_name AS stateName,
      population
    FROM
      state
    WHERE
      state_id='${stateId}';`;
  const statesArray = await db.get(getStatesQuery);
  response.send(statesArray);
});

//Add District API
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
  INSERT INTO 
  district
  (district_name,state_id,cases,cured,active,deaths)
  VALUES(
      '${districtName}',
      '${stateId}',
      '${cases}',
      '${cured}',
      '${active}',
      '${deaths}');`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//Get DistrictById API
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictsQuery = `
    SELECT
     district_id AS districtId,
     district_name AS districtName,
     state_id AS stateId,
     cases,
     cured,
     active,
     deaths 
    FROM
      district
    WHERE
      district_id='${districtId}';`;
    const districtsArray = await db.get(getDistrictsQuery);
    response.send(districtsArray);
  }
);

//DELETE DistrictById API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM
    district
    WHERE district_id='${districtId}';`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE District API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const updateDistrictDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = updateDistrictDetails;
    const updateDistrictQuery = `
  UPDATE district
  SET
  district_name='${districtName}',
  state_id='${stateId}',
  cases='${cases}',
  cured='${cured}',
  active='${active}',
  deaths='${deaths}'
  WHERE
  district_id='${districtId}';`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET Stats API
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
    SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
     FROM 
    district NATURAL JOIN state
    WHERE state_id='${stateId}';`;
    const getStatsArray = await db.get(getStatsQuery);
    response.send(getStatsArray);
  }
);

module.exports = app;
