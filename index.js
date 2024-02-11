const express = require ('express');
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY_STRIPE)
const nodemailer = require('nodemailer')

//middleware
const corsOptions = {
  origin: ['http://localhost:5173','http://localhost:5174','https://roam-rift.web.app','https://roam-rift.firebaseapp.com'],
  credentials: true,
  optionSuccessStatus: 200,
}
// app.use(cors());
app.use(cookieParser())
app.use(cors(corsOptions))
app.use(express.json());
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
//Send email 
const sendEmail = (emailAddress, emailData) => {
  //Create a transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL,
      pass: process.env.PASS,
    },
  })

  //verify connection
  transporter.verify((error, success) => {
    if (error) {
      console.log(error)
    } else {
      console.log('Server is ready to take our emails', success)
    }
  })

  const mailBody = {
    from: process.env.MAIL,
    to: emailAddress,
    subject: emailData?.subject,
    html: `<p>${emailData?.message}</p>`,
  }

  transporter.sendMail(mailBody, (error, info) => {
    if (error) {
      console.log(error)
    } else {
      console.log('Email sent: ' + info.response)
    }
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
  sendEmail()
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //after vercel --prod must comment below line
    await client.connect();

    // collections
    const reviewCollection = client.db("RoamRift").collection('reviews')
    const wishListCollection = client.db("RoamRift").collection('wishlist')
    const servicesCollection = client.db("RoamRift").collection('services')
    const usersCollection = client.db("RoamRift").collection('users')
    const bookingsCollection = client.db("RoamRift").collection('bookings')

    ////Role verification middleware
    ///For Admin

    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      console.log('user from verifyAdmin',user);
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
    
      if (!result || result?.role !== 'Admin') {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
    
      // Call next() only if the conditions are met
      next();
    };
    

    ///For Tour Guide
    const verifyTourGuide = async (req, res, next)=>{
      const user = req.user
      const query = { email: user?.email}
      const result = await usersCollection.findOne(query)
      if(!result || result?.role !== 'Tour Guide') {
        return res.status(401).send({message: 'unauthorized access'})
      }
    // Call next() only if the conditions are met
    next()
    }


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
    // app.get('/logout', async (req, res) => {
    //   try {
    //     res
    //       .clearCookie('token', {
    //         maxAge: 0,
    //         secure: process.env.NODE_ENV === 'production',
    //         sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    //       })
    //       .send({ success: true })
    //     console.log('Logout successful')
    //   } catch (err) {
    //     res.status(500).send(err)
    //   }
    // })

    app.get('/logout', async (req, res) => {
      try {
        res.clearCookie('token', {
          maxAge: 0,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        });
        console.log('Logout successful');
        res.send({ success: true });
      } catch (err) {
        console.error('Logout error:', err);
        res.status(500).send({ success: false, error: 'Logout failed' });
      }
    });
    

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

    // get all services
    app.get('/services',async(req,res)=>{
      const result = await servicesCollection.find().toArray();
      res.send(result);
  })
    // get single services
  //   app.get('/service/:id',async(req,res)=>{
  //     const id = req.params.id
  //     const result = await servicesCollection.findOne({_id: new ObjectId(id)});
  //     res.send(result);
  // })

  //save service in a database through form
  app.post('/addService',verifyToken,async(req,res)=>{
    const service = req.body
    const result = await servicesCollection.insertOne(service)
    res.send(result)
  })

  //get service for Tour Guide
  app.get('/services/:email',verifyToken, async (req, res) => {
    const email = req.params.email
    const result = await servicesCollection.find({ 'host.service_provider_email': email }).toArray();
    res.send(result);
  })

  //get user ROLE
  app.get('/user/:email',async (req,res)=>{
    const email = req.params.email;
    const result = await usersCollection.findOne({email})
    res.send(result)
  })

  //get service email for tour guide details page /////self paknami
  // app.get('/guideBio/:email', async (req, res) => {
  //   const email = req.params.email
  //   const result = await servicesCollection.findOne({ 'host.service_provider_email': email }).toArray();
  //   res.send(result);
  // })


  //////////start this code is not proper workable this action required on chatgpt provided code
  //Generate client secret for stripe payment
  // app.post('/create-payment-intent',verifyToken,async(req,res)=>{
  //   const { price } = req.body;
  //   const amount = parseInt(price * 100);
  //   console.log(amount)
  //   if(!price || amount < 1 ) return
  //   const {client_secret} = await stripe.paymentIntents.create({
  //     amount: amount,
  //     currency: 'usd',
  //     payment_method_types: ['card']
  //   })
  //   res.send({clientSecret: client_secret})
  // })

  // save booking info in booking collection and db
  // app.post('/bookings',verifyToken,async(req,res)=>{
  //   const booking = req.body;
  //   const result = await bookingsCollection.insertOne(booking)
    //send email
  //   res.send(result)
  // })


  ////////Chat gpt provided

  //Generate client secret for stripe payment
  app.post('/create-payment-intent', verifyToken, async (req, res) => {
    try {
      const { price } = req.body;
      const amount = parseInt(price * 100);
  
      if (!price || amount <= 0) {
        return res.status(400).send({ error: 'Invalid amount' });
      }
  
      const { client_secret } = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card'],
      });
  
      res.send({ clientSecret: client_secret });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).send({ error: 'Internal Server Error' });
    }
  });
  

  //save booking info in booking collection and db
  app.post('/bookings', verifyToken, async (req, res) => {
    try {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
  
      // send email or perform other post-booking actions
      if (result.insertedId) {
        // To guest
        sendEmail(booking.guest.touristEmail, {
          subject: 'Booking Successful!',
          message: `Your Transaction Id: ${booking.transactionId} When Our Tour is Ready We will send you email. Now patience for Email`,
        })

        // To Host
        sendEmail(booking.TourGuide, {
          subject: 'Your Package got booked by!',
          message: `${booking.guest.touristName}`,
        })
      }
  
      res.send(result);
    } catch (error) {
      console.error('Error saving booking info:', error);
      res.status(500).send({ error: 'Internal Server Error' });
    }
  });
  

  //update service booking status
  // app.patch('/services/status/:id',async (req,res)=>{
  //   const id = req.params.body;
  //   const status = req.body.status
  //   const query = {_id: new ObjectId(id)}
  //   const updateDoc = {
  //     $set: {
  //       booked: status,
  //     },
  //   }
  // })


  //get all bookings for Tourist
  app.get('/bookings', verifyToken,async (req,res)=>{
    const email = req.query.email
    if(!email) return res.send([])
    const query =  {'guest.touristEmail':email}
    const result = await bookingsCollection.find(query).toArray()
    res.send(result)
  })
  //get all bookings for TourGuide
  app.get('/bookings/TourGuide', verifyToken,verifyTourGuide,async (req,res)=>{
    const email = req.query.email
    if(!email) return res.send([])
    const query =  {TourGuide:email}
    const result = await bookingsCollection.find(query).toArray()
    res.send(result)
  })

  //get all users
  app.get('/users',verifyToken,verifyAdmin,async(req,res)=>{
    const result = await usersCollection.find().toArray()
    res.send(result)
  })

  //update user role 
  app.put('/users/update/:email',verifyToken,async(req,res)=>{
    const email = req.params.email;
    const user = req.body;
    const query = {email:email}
    const options = {upsert:true}
    const updateDoc = {
      $set:{
        ...user,
        timestamp : Date.now(),
      },
    }
    const result = await usersCollection.updateOne(query,updateDoc,options)
    res.send(result)
  })

  //Become a host/Tour Guide
  app.patch('/user/:email', async (req, res) => {
    const email = req.params.email
    const user = req.body
    const query = { email: email }
    const options = { upsert: true }
    const isExist = await usersCollection.findOne(query)
    console.log('User found?----->', isExist)
    if (isExist) {
      if(user?.status === 'Requested'){
        const result = await usersCollection.updateOne(
          query,
          {
            $set: user,
          },
          options,
          )
          return res.send(result)
      }else{
        return res.send(isExist)
      }
    }
    const result = await usersCollection.updateOne(
      query,
      {
        $set: { ...user, timestamp: Date.now() },
      },
      options
    )
    res.send(result)
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