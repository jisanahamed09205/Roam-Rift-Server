const express = require ('express');
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


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
    await client.connect();

    // collections
    const reviewCollection = client.db("RoamRift").collection('reviews')
    const wishListCollection = client.db("RoamRift").collection('wishlist')
    const servicesCollection = client.db("RoamRift").collection('services')

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