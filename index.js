const express = require ('express');
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;

//middleware
const corsOptions = {
  origin: ['http://localhost:5173'],
  credentials: true,
  optionSuccessStatus: 200,
}
// app.use(cors());
app.use(express.json());
app.use(cors(corsOptions))
app.use(cookieParser())
// app.use(morgan('dev'))

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s0a6uh7.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //after vercel --prod must comment below line
    await client.connect();

    // collections
    const reviewCollection = client.db("RoamRift").collection('reviews')
    const wishListCollection = client.db("RoamRift").collection('wishlist')
    const servicesCollection = client.db("RoamRift").collection('services')
    const usersCollection = client.db("RoamRift").collection('users')

    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      console.log('I need a new jwt', user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })

    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    // Save or modify user email, status in DB
    app.put('/users/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email: email }
      const options = { upsert: true }
      const isExist = await usersCollection.findOne(query)
      console.log('User found?----->', isExist)
      if (isExist) return res.send(isExist)
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      )
      res.send(result)
    })

    //reviews collections
    app.get('/reviews',async(req,res)=>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

    //wishlist collections
    app.post('/wishlist',async(req,res)=>{
      const wishItem = req.body;
      const result = await wishListCollection.insertOne(wishItem)
      res.send(result)
    })

    //services collection
    app.get('/services',async(req,res)=>{
      const result = await servicesCollection.find().toArray();
      // const  = await cursor.toArray();
      res.send(result);
  })

    // Send a ping to confirm a successful connection
     //after vercel --prod must comment below two line
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('Roam Rift is Running')
})

app.listen(port,()=>{
    console.log(`Roam Rift is running on port ${port}`);
})