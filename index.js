const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require("jsonwebtoken")
const app = express()
const port = process.env.PORT || 5000

//middleware
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lyu72pb.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  })
}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    /*  await client.connect(); */



    const classCollection = client.db("fluentMindDb").collection("classes");
    const userCollection = client.db("fluentMindDb").collection("users");
    const bookingCollection = client.db("fluentMindDb").collection("bookings");


    // user 
    app.get("/users", verifyJWT, async (req, res) => {
      let query = {};
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/classes', async (req, res) => {
      let query = {}
      if (req.query?.email) {
        query = {
          email: req.query.email,
        }
      }
      const result = await classCollection.find(query).toArray();
      res.send(result);
    })


    app.get('/bookings', async (req, res) => {
      let query = {}, result = {}
      if (req.query?.email) {
        query = {
          userEmail: req.query.email,
        }
        result = await bookingCollection.find(query).toArray();
      }
      res.send(result);
    })

    app.get('/classes/:id', async (req, res) => {
      const id = req.params.id;
      let query, isBooked = false;
      if (req.query?.email) {
        query = {
          userEmail: req.query.email
        }
        const bookings = await bookingCollection.findOne(query)
        if (bookings?._id) {
          isBooked = true
        }
      }
      query = { _id: new ObjectId(id) }
      let result = await classCollection.findOne(query)
      if (result?._id) {
        result.isBooked = isBooked
      }
      res.send(result)
    })


    app.post('/class', async (req, res) => {
      const classes = req.body;
      const result = await classCollection.insertOne(classes)
      res.send(result);
    })

    /* bookings api for select btn */
    app.post('/bookings', async (req, res) => {
      const bookings = req.body;
      const filter = { _id: new ObjectId(bookings.classID) };

      const result = await bookingCollection.insertOne(bookings)

      if (result.insertedId) {
        let status = await classCollection.updateOne(filter, { $inc: { enrolled: 1 } });
      }
      res.send(result);
    })



    app.post('/jwtANDusers', async (req, res) => {
      const u = req.body;
      const query = { email: u.email };
      let user = await userCollection.findOne(query);
      if (!user && u?.insert) {
        delete u.insert;
        let status = await userCollection.insertOne(u);
        user = await userCollection.findOne(query);
      }
      if (user) {
        let token = jwt.sign({ email: u.email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
        let role = user.role;
        return res.send({ token, role });
      }
      res.send({})

    });


    /* class update api */
    app.put('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedClass = req.body;
      const toy = {
        $set: {
          className: updatedClass.className,
          classImage: updatedClass.classImage,
          price: updatedClass.price,
          seats: updatedClass.seats,
        }
      }
      const result = await classCollection.updateOne(filter, toy, options)
      res.send(result)
    })

    // update makeinstructor
    app.put("/makeinstructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateInstructor = req.body;
      const instructor = {
        $set: {
          role: updateInstructor.role
        },
      };
      const result = await userCollection.updateOne(
        filter,
        instructor,
        options
      );
      res.send(result);
    });

    /* class delete api */
    app.delete('/classes/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result)
    })

    /* bookings delete api */
    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result)
    })

    // delete for user
    app.delete("/users/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });




    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    /* await client.close(); */
  }
}
run().catch(console.dir);







app.get('/', (req, res) => {
  res.send('Fluent Minds is running')
})


app.listen(port, () => {
  console.log(`Fluent Minds is running on port ${port}`)
})