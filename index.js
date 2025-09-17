import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "", // removed for github - will link later
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 1;
let message = "Enter country name";
let errorMessage = "";

// Users has hardcoded people via coursework - left for when PostgreSQL database is not connected
let users = [
  { id: 1, name: "Angela", color: "teal" },
  { id: 2, name: "Jack", color: "powderblue" },
];
 

async function getUsers() {
  const result = await db.query("SELECT * FROM users");
  users = result.rows;
  return users;
};

async function getCurrentUserColor() {
  try {
    let currentUserColor = users.find((user) => user["id"] == currentUserId)["color"];
    return currentUserColor;
  } catch(error) {
    errorMessage = "User was not defined before pulling color";
    console.error(errorMessage);
    return;
  }
};

async function displayVisited() {
  const result = await db.query("SELECT country_code FROM visited_countries WHERE user_id = $1", [currentUserId]); 
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

async function verifiedAdd(newCountryVisited) {
  const currentVisitedCountryList = await displayVisited();
  let newVisitedCountryCode = "";
  let firstVisit = false;
  let country;
  let countryCode;
  try {
    country = await db.query("SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%'", [newCountryVisited.toLowerCase()]);
    countryCode = country.rows[0].country_code;
  } catch(error) {
    new Error('Database could not pull country code.');
    errorMessage = newCountryVisited + ", the country you entered could not be found in the database we are using. Please check spelling, possibly the formality of name added, and retry. If the problem persists please submit a support ticket.";
    console.error(newCountryVisited + ", the country you entered could not be found in the database we are using. Please check spelling, possibly the formality of name added, and retry. If the problem persists please submit a support ticket.");
    return;
  } finally {
     setTimeout(() => {
      message = "Enter country name";
      errorMessage = "";
    }, 2000);
  }

  // GETTING THE COUNTRY CODE FOR THE NEW COUNTRY ATTEMPTING TO BE ADDED
  if (newCountryVisited != "") {
    if(countryCode != "" && (countryCode != undefined || countryCode != null)) {
      newVisitedCountryCode = countryCode;
    } 
 
    if (newVisitedCountryCode == "") {
      errorMessage = newCountryVisited + ", the country you entered could not be found in the database we are using. Please check spelling, possibly the formality of name added, and retry. If the problem persists please submit a support ticket.";
      console.error(newCountryVisited + ", the country you entered could not be found in the database we are using. Please check spelling, possibly the formality of name added, and retry. If the problem persists please submit a support ticket.");
      return;
    }
    
  } else {
    errorMessage = "Please type country name before hitting add.";
    console.error("Please type country name before hitting add.");
    return;
  }
// CHECKING NEW COUNTRY'S COUNTRY CODE AGAINST VISITED COUNTRY LIST TO PREVENT DUPLICATES
    if (newVisitedCountryCode != "") {
      let checkCounter = 0;
      let checkTotal = currentVisitedCountryList.length;
      for (let i = 0; i < currentVisitedCountryList.length; i++) {
        if (newVisitedCountryCode == currentVisitedCountryList[i]) {
          errorMessage = "Unable to add. It appears you have already added this country.";
          console.error("Unable to add. It appears you have already added this country.");
          return;
        } else {
          checkCounter++;
        }
      }
      if (checkCounter === checkTotal) {
        firstVisit = true;
      }
      if (firstVisit = true) {
        db.query("INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",[newVisitedCountryCode, currentUserId]);
        message = newCountryVisited + " has been added to your list of countries visited. Enter a new country name if you would like to add another.";
        errorMessage = "";
        console.log(newCountryVisited + "'s country code, " + newVisitedCountryCode + ", has been added to the list of visited countries for " + users.find((user) => user["id"] == currentUserId)["name"]);
        return;
      }
      } else {
        console.error("Error: issue accessing and storing country code of the country being added. Variable was left blank.");
        return;
      }
};


app.get("/", async (req, res) => {
  const users = await getUsers();  
  const countries = await displayVisited();
  let currentUserColor =  await getCurrentUserColor();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: currentUserColor,
    message: message,
    error : errorMessage
  });
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  await verifiedAdd(input);
  res.redirect("/");
});

app.post("/user", async (req, res) => {
  currentUserId = req.body["user"];
  if (req.body["add"]) {
    res.render("new.ejs");
  } else {
    res.redirect("/");
  }
});

async function verifiedAddUser(name, color) {
  try {
    await db.query("INSERT INTO users (name, color) VALUES ($1, $2)", [name, color]);
  } catch(error) {
    if (error.code === '23505') { 
      let errorMessage = `${name} is already in our database with that name and the color of ${color}. Please choose a different color and retry. If the problem persists please submit a support ticket.`;
      console.error(errorMessage);
      return errorMessage; 
    } else {
      throw new Error('User could not be added to database.');
    }
  } finally {
    message = `${name} with their chosen color of ${color} has been added.`;
  }
};

app.post("/new", async (req, res) => {
  let newUser = req.body["name"];
  let newUserColor = req.body["color"];
  if ((newUser != "" || newUser != null || newUser != undefined) && (newUserColor != "" || newUserColor != null || newUserColor != undefined)) {
    let errorMessage = await verifiedAddUser(newUser, newUserColor);
    if (errorMessage) {
      res.render("new.ejs", {
        error: errorMessage
      }); 
    } else {
      res.redirect("/");
    }
  } else {
    errorMessage = "Name or color was left blank, please retry."
    res.render("new.ejs", {
      error: errorMessage
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
