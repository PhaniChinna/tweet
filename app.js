const express = require("express");
const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
const initializeDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB Error ${error.message}`);
    process.exit(1);
  }
};
initializeDbServer();

const validPassword = (password) => {
  return password.length > 6;
};

const authToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.header["Authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split("")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET-KEY", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    const InsertQuery = `
        INSERT INTO 
            user(username , password , name , gender)
        VALUES('${username}' , '${hashedPassword}' , '${name}' , '${gender}')`;
    if (validPassword(password)) {
      const List = await db.run(InsertQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const IsPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (IsPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET-KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 3
app.get("/user/tweets/feed/", authToken, async (request, response) => {
  const userTweet = `
        SELECT 
            user.username , tweet.tweet , tweet.date_time AS dateTime
        FROM 
          follower 
        INNER JOIN user
            ON follower.follower_user_id = user.user_id
        INNER JOIN tweet 
             ON user.user_id = tweet.user_id
        WHERE 
           follower.follower_user_id = follower_user_id
        ORDER BY 
            tweet.date_time DESC
        LIMIT 4`;
  const result = await db.all(userTweet);
  response.send(result);
});

//API 4
app.get("/user/following/", authToken, async (request, response) => {
  const userFollowing = `
        SELECT 
           user.name 
        FROM 
           follower 
        INNER JOIN user 
            ON follower.follower_id = user.user_id`;
  const Result = await db.all(userFollowing);
  response.send(Result);
});

//API 5
app.get("/user/followers/", authToken, async (request, response) => {
  const followerUser = `
        SELECT 
          user.name 
        FROM 
           follower
        INNER JOIN user 
            ON user.user_id = follower.follower_id
        WHERE 
           user.user_id = user_id`;
  const Result = await db.all(followerUser);
  response.send(Result);
});

//API 6
app.get("/tweets/:tweetId/", authToken, async (request, response) => {
  const { tweetId } = request.params;
  const selectRequest = `
        SELECT 
          tweet.tweet  , like.user_id AS like , reply.tweet_id AS reply , tweet.date_time AS dateTime
         FROM 
           follower 
        INNER JOIN tweet 
          ON tweet.tweet_id = follower.follower_id
        INNER JOIN like
           ON like.like_id = follower.follower_id
        INNER JOIN reply 
            ON reply.reply_id = follower.follower_id`;
  const Result = await db.get(selectRequest);
  if (Result !== undefined) {
    response.send(Result);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 7
app.get("/tweets/:tweetId/likes/", authToken, async (request, response) => {
  const { tweetId } = request.params;
  const SelectQuery = `
        SELECT 
           DISTINCT(tweet_id) 
        FROM
          follower 
        INNER JOIN tweet 
           ON follower.follower_id = tweet.tweet_id
        WHERE 
           tweet_id = '${tweetId}'`;
  const result = await db.get(SelectQuery);
  if (result === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const likeQuery = `
        SELECT 
          user.username
        FROM 
          user 
        NATURAL JOIN tweet 
        WHERE 
           tweet_id = '${tweetId}'`;
    const Final = await db.all(likeQuery);
    response.send({ likes: Final });
  }
});

//API 8
app.get("/tweets/:tweetId/replies/", authToken, async (request, response) => {
  const { tweetId } = request.params;
  const selectQuery = `
        SELECT 
           DISTINCT(tweet_id)
        FROM 
            follower
        INNER JOIN tweet
           ON follower.follower_id = tweet.tweet_id
        WHERE 
           tweet_id = '${tweetId}'`;
  const Result = await db.get(selectQuery);
  if (Result === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const tweetQuery = `
        SELECT 
           name,reply 
        FROM 
           reply
        NATURAL JOIN user 
        WHERE 
           tweet_id = '${tweetId}'`;
    const FinalResult = await db.all(tweetQuery);
    response.send({ replies: FinalResult });
  }
});

//API 9
app.get("/user/tweets/", authToken, async (request, response) => {
  const SelectTweets = `
       SELECT   
          tweet.tweet , tweet.date_time AS dateTime , like.user_id AS like , reply.tweet_id AS reply
        FROM 
           follower 
        INNER JOIN tweet 
           ON tweet.tweet_id = follower.follower_id
        INNER JOIN like 
            ON like.user_id = follower.follower_id
        INNER JOIN reply 
            ON reply.user_id = follower.follower_id`;
  const finalResult = await db.all(SelectTweets);
  response.send(finalResult);
});

//API 10

app.post("/user/tweets/", authToken, async (request, response) => {
  const { tweet } = request.body;
  const selectTweetQuery = `
       INSERT INTO 
           tweet(tweet)
        VALUES 
           ('${tweet}') `;
  const Result = await db.run(selectTweetQuery);
  response.send("Created a Tweet");
});

//API 11

app.delete("/tweets/:tweetId/", authToken, async (request, response) => {
  const { tweetId } = request.params;
  const deleteQuery = `
        SELECT 
           DISTINCT(tweet_id)
        FROM 
          follower
        INNER JOIN tweet 
           ON follower.follower_id = tweet.tweet_id`;
  const Result = await db.get(deleteQuery);
  if (Result === undefined) {
    response.status(401);
    response.send("Invalid User");
  } else {
    const DeleteQuery = `
        DELETE 
        FROM 
          tweet 
        WHERE 
          tweet_id = '${tweetId}'`;
    const FinalResult = await db.all(DeleteQuery);
    response.send("Tweet Removed");
  }
});
module.exports = app;
