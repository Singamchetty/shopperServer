const express = require("express");
const serverless = require('serverless-http');
const { ObjectId } = require("mongodb")
const cors = require("cors");
const { MongoClient } = require("mongodb");

const connectionString = "mongodb+srv://tblusers:Users12345@cluster0.xloadee.mongodb.net/";
const dbName = "ecommerce";

const app = express();
const router = express.Router();

let records=[]

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Create a reusable MongoClient instance for connection pooling
const client = new MongoClient(connectionString,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    connectTimeoutMS: 30000, // Connection timeout in milliseconds
  });
client.connect()
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
  });

  let db=client.db(dbName);

router.get('/products', async (req, res) => {
  await  db.collection('products').find().toArray()
        .then(result => { res.send(result) })
        .catch(error => res.status(500).send(error))
})

// router.get('/products', (req, res) => {
//     const  pageIndex=parseInt(req.query.p || "0")
//     let pageSize=5;
//     db.collection('products').find().skip(pageIndex*pageSize).limit(pageSize).toArray()
//     .then(result => {res.send(result)})
//     .catch(error => res.status(500).send(error))
// })

router.get('/products/:id', async (req, res) => {
    const id = req.params.id;

    if (!isNaN(id)) {
        const numericId = Number(id);
      await  db.collection('products').findOne({ id: numericId })
            .then(result => {
                if (result != null) {
                    res.status(200).json(result);
                } else {
                    res.status(404).json({ error: 'Product not found' });
                }
            })
            .catch(error => res.status(400).json({ error: 'Invalid ID' }));
    } else if (/^[a-zA-Z]+$/.test(id)) {
        res.status(404).json({ error: 'Invalid ID' });
    } else {
        res.status(400).json({ error: 'Invalid ID' });
    }
});

// Middleware function to check if userId already exists
const checkUserIdExists = async (req, res, next) => {
    const userId = req.body.userId.trim();
   await  db.collection('users').findOne({ userId: userId })
        .then(result => {
            if (result) {
                res.status(400).json({ error: "userId already exists" });
            } else {
                next(); // Proceed to register user if userId is not taken
            }
        })
        .catch(error => res.status(500).json({ error: "Internal server error" }));
};

// Register User endpoint with middleware
router.post('/registeruser', checkUserIdExists, async (req, res) => {
    const user = req.body;
    const userid = req.body.userId;
    await db.collection('users').insertOne(user)
        .then(result => {
            res.status(201).json(result);
            db.collection('cartitems').insertOne({ userId: userid, cartItems: [] })
        })
        .catch(err => res.status(500).json({ error: "Could not create a new document" }));
});

// Get Users endpoint
router.get('/users', async(req, res) => {
    // db.collection('users').find({}, { projection: { _id: false, userId: true, password: true } }).toArray()
   await db.collection('users').find({}, { projection: { _id: false } }).toArray()
        .then(result => {
            res.send(result);
        })
        .catch(error => res.status(500).send(error));
});

//login api
router.post('/login', async (req, res) => {
    const { userId, password } = req.body;
    try {
      const user = await db.collection('users').findOne({userId:userId})
      if (!user) {
        return res.status(401).json({ error: 'Authentication failed', message: 'User not found' });
      }
      if (password === user.password && userId === user.userId) { 
        delete user.password;
        delete user._id;
        res.json({ message: 'Login successful', user });
      } else {
        res.status(401).json({ error: 'Authentication failed', message: 'Email and password do not match' });
      }
    }
    catch (error) {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

router.delete('/deregister/:userid', async(req, res) => {
    const userid = req.params.userid
    if (isNaN(userid)) {
       await db.collection('users').deleteOne({ userId: userid })
            .then(async (result) => {
                res.send(result)
                await db.collection('cartitems').deleteOne({ userId: userid })
            })
            .catch(error => res.status(500).send(error))
    } else {
        res.status(500).json({ error: 'Invalid ID' })
    }
})

router.patch('/updateuser/:id', async(req, res) => {
    const Id = req.params.id
    const data = req.body
    if (ObjectId.isValid(Id)) {
       await db.collection('users').updateOne({ _id: new ObjectId(Id) }, { $set: data })
            .then(result => { res.send(result) })
            .catch(error => res.status(500).send(error))
    } else {
        res.status(500).json({ error: 'Invalid ID' })
    }
})

router.get('/cartItems/:userid',async (req, res) => {
    const userid = req.params.userid
    const usernameRegex = /^[a-zA-Z0-9_]{1,10}$/;
    if (usernameRegex.test(userid)) {
        try {
            const result = await db.collection('cartitems').findOne({ userId: userid });
            if (result != null) {
                res.status(200).send(result);
            } else {
                // Create a new cartItems collection
                const userName = userid; // Assuming userName is the same as userId
                const newCollection = {
                    userId: userName,
                    cartItems: []
                };
                await db.collection('cartitems').insertOne(newCollection);
                res.status(200).send(newCollection);
            }
        } catch (error) {
            res.status(401).send(error);
        }
    } else {
        res.status(400).json({ error: 'Invalid UserId' })
    }
})

router.patch('/updateCartItems/:userid', async (req, res) => {
    const userid = req.params.userid;
    const newCartItem = req.body;

    // Check if userid is a number
    if (!isNaN(userid)) {
        return res.status(400).json({ error: 'Invalid UserId' });
    }

    try {
        // const cart = await db.collection('cartitems').findOne({ userId: userid });

        // if (!cart) {
        //     // If cart doesn't exist, create a new one with the newCartItem
        //     await db.collection('cartitems').insertOne({ userId: userid, cartItems: [newCartItem] });
        //     return res.status(200).json({ message: 'Cart created with new item' });
        // }

        // // Check if the item already exists in the cart
        // const existingItemIndex = cart.cartItems.findIndex(item => item.id === newCartItem.id);

        // if (existingItemIndex !== -1) {
        //     // If the item already exists, increase its quantity by 1
        //     cart.cartItems[existingItemIndex].qty += 1;
        // } else {
        //     // If the item doesn't exist, add it to the cart
        //     cart.cartItems.push(newCartItem);
        // }
        // // Update the cart with the modified cartItems
        // await db.collection('cartitems').updateOne({ userId: userid }, { $set: { cartItems: cart.cartItems } });
        await db.collection('cartitems').updateOne({ userId: userid }, { $set: { cartItems: newCartItem } });
        return res.status(200).json({ message: 'Cart updated successfully' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});



app.use('/.netlify/functions/api',router)
module.exports.handler=serverless(app)
