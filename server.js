/* server.js nov19 - 3pm */
'use strict';
const log = console.log;

const express = require('express')
const port = process.env.PORT || 3000
const bodyParser = require('body-parser') // middleware for parsing HTTP body from client
const { ObjectID } = require('mongodb')

// objectID(customer) 

// Import our mongoose connection
const { mongoose } = require('./db/mongoose');

// Import the models
const { User } = require('./models/user')
const { Dish } = require('./models/dish')


// express
const app = express();
const path = require('path')

//Express Validator & flash
const expressValidator = require('express-validator')
const flash = require('connect-flash-plus');

//Postal Code Checker
const postcode = require('postcode-validator');

app.use(express.static('views'))
// body-parser middleware setup.  Will parse the JSON and convert to object
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true})) //to parse form data

//EJS
app.engine('html', require('ejs').renderFile)
app.set('view engine', 'ejs') //ejs files are rendered instead of html


//For user authentication
const {SHA256} = require('crypto-js')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const session = require('express-session')

// for AWS S3
const multer = require('multer');
const multerS3 = require('multer-s3');
const aws = require('aws-sdk');

require('dotenv').config();


//Express Session Middleware
app.use(session({ 
	secret: 'secretkey', 
	cookie: { maxAge: 300000 }
	
}))

// Express Messages Middleware
app.use(require('connect-flash')());
app.use(function(req, res, next){
	res.locals.messages = require('express-messages')(req,res);
	next();
});

// Express Validator Middleware
app.use(expressValidator({
	errorFormatter: function(param, msg, value) {
		var namespace = param.split('.')
		, root    = namespace.shift()
		, formParam = root;
		
		while(namespace.length) {
			formParam += '[' + namespace.shift() + ']';
		}
		return {
			param : formParam,
			msg   : msg,
			value : value
		};
	}
}));


// const storage = multer.diskStorage({
// 	destination: function(req, file, cb) {
//     // cb(null, './views/uploads/'
//     cb(null, __dirname+'/views/uploads/') 
// },
// filename: function(req, file, cb) {
//     // cb(null, new Date().toISOString() + file.originalname)
//     cb(null, file.fieldname+"_"+Date.now()+"_" + file.originalname)
// }
// })
// const upload = multer({storage: storage}) 

//AWS S3 Image Upload CODE --------------------------
aws.config.update({
	// Your SECRET ACCESS KEY from AWS should go here,
	// Never share it!
	// Setup Env Variable, e.g: process.env.SECRET_ACCESS_KEY
	secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
	// Not working key, Your ACCESS KEY ID from AWS should go here,
	// Never share it!
	// Setup Env Variable, e.g: process.env.ACCESS_KEY_ID
	accessKeyId: process.env.S3_ACCESS_KEY_ID,
	region: process.env.S3_REGION // region of your bucket
});

const s3 = new aws.S3();

const upload = multer({
	storage: multerS3({
		s3: s3,
		bucket: process.env.S3_BUCKET_NAME,
		acl: 'public-read',
		metadata: function (req, file, cb) {
			cb(null, {fieldName: file.fieldname});
		},
		key: function (req, file, cb) {
			cb(null, Date.now().toString())
		}
	})
})

// ---------------------------------------------------



/// Routes go below

//Get homepage
app.get('/', (req, res) => {
	if(req.session.user) {
		switch(req.session.user.usertype) {
			case "chef":
			res.redirect('/chefs/' + req.session.user._id)
			break;
			case "customer":
			res.redirect('/customers/' + req.session.user._id)
			break;
			case "admin":
			res.redirect('/admin')
			break;
			default:
			return res.status(401).json({
				message: 'Invalid User: does not have type'
			})
		}
	} else {
		res.render('index')
	}
	
})

app.post('/signup', (req, res) => {
	
	log(req.body)
	
	//Sign up Form Checks that fields are filled 
	req.checkBody('email', 'Email is Invalid').isEmail();
	req.checkBody('name', 'Name Must be longer than 1 letter').isLength({min: 2})
	req.checkBody('phone', 'Phone must be 10 characters long.').isLength(10)
	req.checkBody('phone', 'Phone must only contain digits.').isInt();
	
	
	req.checkBody('password', 'Password must be longer than 6 characters').isLength({min: 6})
	
	
	
	req.checkBody('postalcode', 'Postal Code must be of 6 characters').isLength(6)
	req.checkBody('postalcode', 'Postal Code is Invalid').custom(value=>{
		//checking for valid CANADIAN SIGN UP CODE
		return postcode.validate(req.body.postalcode,'CA')
	})
	
	let errors = req.validationErrors();
	
	if(errors){
		res.render('index.ejs',{
			errors:errors
		})
		
	}else{
		
		bcrypt.genSalt(10, (error, salt) => {
			bcrypt.hash(req.body.password, salt, (err, hash) => {
				
				if(req.body.email === "admin@chefsnextdoor.com") {
					req.body.usertype = 'admin'
				}
				// Create a new user
				const user = new User({
					name: req.body.name,
					usertype: req.body.usertype,
					phone: req.body.phone,
					postalcode: req.body.postalcode,
					email: req.body.email,
					password: hash
				})	
				
				User.find({ email: req.body.email}).exec().then(search => {
					if(search.length > 0) {
						// return res.status(401).json({
						// 	message: 'Email not found'
						// })
						console.log("Email ALready Exists")
						req.flash('danger', 'Email Has Been Taken Already')
						res.status(401).redirect('/')
						
					}
					else {
						// save user to database
						user.save().then((result) => {
							req.session.user = result
							//log(req.session.user)
							//log(req.session.user.usertype)
							switch(req.session.user.usertype) {
								case "chef":
								res.redirect('/chefs/'+ req.session.user._id)
								break;
								case "customer":
								res.redirect('/customers/'+ req.session.user._id)
								break;
								case "admin":
								res.redirect('/admin')
								break;
								default:
								res.status(401).json({
									message: 'Invalid User: does not have type'
								})
							}
						}, (error) => {
							console.log("User Validation Failed!")
							res.status(400).send(error) // 400 for bad request
						}) //ending user.save()
						
					}//end of else above user.save()
					
				}) //ending User.find()
				
			}) //bcrypt hash
		}) //bcrypt gen salt
		
	}//else above gen salt
})//route end

app.post('/login', (req, res) => {
	
	// log(req.body.email)
	
	//express validator
	req.checkBody('email','Email is Required').notEmpty();
	if(req.body.email){
		//check after email is present
		req.checkBody('email', 'Email is Invalid').isEmail()
	}
	req.checkBody('password','Password is Required').notEmpty();
	
	let errors = req.validationErrors();
	
	if(errors){
		res.render('index.ejs',{
			errors:errors
		})
		
	}else{
		
		User.find({ email: req.body.email}).exec().then(user => {
			if(user.length < 1) {
				// return res.status(401).json({
				// 	message: 'Email not found'
				// })
				// console.log("USER NOT FOUND")
				req.flash('danger', 'User Does Not Exist!')
				res.status(401).redirect('/')
			}
			else {
				//User accoutn exist check password
				bcrypt.compare(req.body.password, user[0].password, (err, result) => {
					if(err) {
						log({error: err.message})
						req.flash('danger', "Something Went Wrong")						
						res.redirect('/')
						// return res.status(401).json({
						// 	message: 'Password Invalid'
						// })
						// console.log("User Entered Wrong Password")
						// req.flash('danger', 'Invalid Password. Try Again.')
						// res.status(401).redirect('/')
					}
					if(result) {
						
						req.session.user = user[0]
						switch(req.session.user.usertype) {
							case "chef":
							res.redirect('/chefs/' + req.session.user._id)
							break;
							case "customer":
							res.redirect('/customers/' + req.session.user._id)
							break;
							case "admin":
							res.redirect('/admin')
							break;
							default:
							return res.status(401).json({
								message: 'Invalid User: does not have type'
							})
						}
					}else{
						// console.log("User Entered Wrong Password")
						req.flash('danger', 'Invalid Password. Try Again.')
						res.status(401).redirect('/')
					}
				})
			}
		}).catch((err)=>{
			log({error: err.message})
			req.flash('Error:', err.message)
			redirect('/')
		})
		
	}
	
})

app.get('/logout', function (req, res) {
	req.session.destroy();
	res.redirect('/');
})


//middleware to protect routes
//only lets you proceed if you are admin or if the userid you are trying to access belongs to you
const authenticate = (req, res, next) => {
	if(req.session.user) {
		if(req.session.user.usertype === 'admin' || req.session.user._id === req.params.id) {
			next()
		} else {
			res.redirect('/')
		}
	} else {
		res.redirect('/')
	}
}

// if logged-in user is a chef
app.get('/chefs/:id', authenticate, (req, res) => {
	//log(req.session)
	const chefId = req.params.id
	//only show the dishes that belong to the chef
	User.findById(chefId).then((chef) => {
		if (!chef) {
			res.status(404).send()
		} else {
			res.render('chef_dashboard', {chef: chef, session_user: req.session.user})
		}
	})
})


// if logged-in user is a regular customer
app.get('/customers/:id', authenticate, (req, res) => {
	//log(req.session)
	const customerId = req.params.id
	
	User.findById(customerId).then((customer) => {
		if (!customer) {
			res.status(404).send()
		} else {
			//customer should be able to see dishes of all chefs
			User.find({usertype: "chef"}).then((chefs) => {
				res.render('customer_dashboard', {chefs: chefs, customer: customer, session_user: req.session.user})
			}, (error) => {
				res.status(400).send(error)
			})
		}
	})
})

// if logged-in user is a regular customer
app.get('/admin', authenticate, (req, res) => {
	//log(req.session)
	//customer should be able to see dishes of all chefs
	User.find().then((users) => {
		res.render('admin_dashboard', {users: users, admin: req.session.user})
	}, (error) => {
		res.status(400).send(error)
	})
	
})

// route to DELETE any user. only admin will have access
// technically user is able to delete his own profile using link. maybe that can be used later
app.delete('/users/:id', (req, res) => {
	const userId = req.params.id
	
	// Good practise is to validate the id
	if (!ObjectID.isValid(userId)) {
		return res.status(404).send()
	}
	
	// Otheriwse, findByIdAndRemove
	User.findByIdAndRemove(userId).then((user) => {
		if (!user) {
			res.status(404).send()
		} else {
			res.status(200).send()
		}
	}).catch((error) => {
		res.status(400).send(error)
	})
})

const singleUpload = upload.single('image');

// Set up a POST route to create a dish
app.post('/chefs/:id/', (req, res) => {
	log(req.body)
	//log(req.file)
	
	const chefId = req.params.id
	
	//Sign up Form Checks that fields are filled 
	req.checkBody('title', 'Dish Title is Required').notEmpty();
	
	req.checkBody('description', 'Dish Description is Required').notEmpty();
	
	req.checkBody('price', 'Price Must be an Integer.').isInt();
	
	// req.checkBody('imageURL', 'Image Is Required').notEmpty();
	
	let errors = req.validationErrors();
	
	if(errors){
		User.findById(chefId).exec((err, chef) => {
			if(err){
				log({error:err.message})
			}
			else{
				res.render('chef_dashboard', {chef: chef, session_user: req.session.user, errors:errors
				})
			}
		})
		
		// res.render('chef_dashboard', {chef: chef, session_user: req.session.user},{
		// 	errors:errors
		// })
		// res.render(('/chefs/'+chefId),{
		// 	errors:errors
		// })
		
	}
	else{ 
		let image_URL;
		
		User.findById(chefId).then((chef) => {
			if (!chef) {
				res.status(404).send()
			} else {
				
				singleUpload(req, res, function(err, some) {
					if (err) {
						return res.status(422).send({errors: [{title: 'Image Upload Error', detail: err.message}] });
					}
					
					// res.json({'imageUrl': req.file.location});
					
					chef.dishes.push({
						title: req.body.title,
						description: req.body.description,
						price: req.body.price,
						imageURL: req.file.location,
					})
					// update user with new dish to database
					chef.save().then((result) => {
						//log("SAVED THE DISH")
						// Save and redirect to all dishes view
						req.flash('success', 'Your New Dish Has Been Posted')	
						res.redirect('/chefs/' + chefId)
					}, (error) => {
						//log("ERROR HAPPENED IN CREATING DISH")
						res.status(400).send(error) // 400 for bad request
					})
					
				});
				
				
			}
			
		}).catch((error) => {
			res.status(400).send(error)
		})
		
		
	}
	
	
})



// Route to DELETE a dish
app.delete('/chefs/:id/:dish_id', (req, res) => {
	
	const chefId = req.params.id
	const dishId = req.params.dish_id
	
	User.findOneAndUpdate(
		{_id: chefId}, 
		{$pull: {dishes: {_id: dishId}}},
		function(err, data){
			if(err) return err;
			req.flash('warning', 'Your Dish Has Been Deleted')		
			res.status(200).send()
		}).catch((error) => {
			res.status(400).send(error)
		})
		
	})
	
	
	// ************************** 
	// Edit the dish
	
	app.post('/editposting/:id/:dishId/',authenticate, (req, res) => {
		
		// console.log ("Route for Editing the Dish");
		// console.log (req.body);
		// console.log (`ChefID: ${req.params.chefId}`)
		// console.log (`DishID: ${req.params.dishId}`)
		// console.log (`Price: ${req.body.reprice}`)
		// console.log (`Des: ${req.body.redescription}`)
		
		
		// Getting the required data in the body of req
		// Find the desired order and update the fields
		
		
		// log ("******** BELOW THIS **********")
		
		
		const chefId = req.params.id
		const dishId = req.params.dishId
		
		const NewPrice = req.body.reprice
		const Description = req.body.redescription
		
		
		const updatedDish = {
			
			description: Description,
			price: NewPrice
			
		}
		// console.log (`UPDATED DISH Object: ${updatedDish.description}`)
		// console.log (`UPDATED DISH Object: ${updatedDish.price}`)
		
		User.findById(chefId).then((chef) => {
			
			// console.log ("Inside findById")
			
			if (!chef) {
				res.status(404).send()
			}else {
				
				const dishObj = chef.dishes.id(dishId) // Will find the correct dish obj
				// console.log (`The dishObj Found: ${dishObj}`)
				
				chef.dishes.id(dishId).set(updatedDish)
				
				chef.save().then((result) => {
					// console.log ("After dish was updated")
					// console.log (`Printing dish object again ${dishObj}`)
					
					//req.flash('success', 'Your Dish Has Been Edited');
					req.flash('success', 'Your Dish Has Been Edited')	
					res.redirect('/chefs/' + chefId)
					
				}).catch((error) => {
					
					res.status(400).send(error)
				})
				
			}
			
		}).catch((error) => {
			
			res.status(400).send(error)
			
		})
		
	});
	
	// ************* CHEF UPDATE YOUR PROFILE *************
	//"/infoChange/<%= chef._id %>/"
	
	app.post('/infoChange/:id/', authenticate, (req, res) => {
		
		// console.log ("Inside info change");
		// console.log (req.body);
		// console.log (`ChefID: ${req.params.chefId}`)
		// console.log (`New Phone: ${req.body.phone}`)
		// console.log (`New Postal: ${req.body.postal}`)
		
		
		// Getting the required data in the body of req
		// Find the desired order and update the fields
		
		
		//     log ("******** BELOW THIS **********")
		
		
		const chefId = req.params.id
		const NewPhone = req.body.phone
		const NewPostal = req.body.postal
		
		
		const updatedChefInfo = {
			
			phone: NewPhone,
			postalcode: NewPostal
			
		}
		//     console.log (`UPDATED DISH Object: ${updatedDish.description}`)
		//     console.log (`UPDATED DISH Object: ${updatedDish.price}`)
		
		// req.checkBody('email', 'Email is Invalid').isEmail();
		// req.checkBody('name', 'Name Must be longer than 1 letter').isLength({min: 2})
		req.checkBody('phone', 'Phone must be 10 characters long.').isLength(10)
		req.checkBody('phone', 'Phone must only contain digits.').isInt();
		
		
		// req.checkBody('password', 'Password must be longer than 6 characters').isLength({min: 6})
		
		
		
		req.checkBody('postal', 'Postal Code must be of 6 characters').isLength(6)
		req.checkBody('postal', 'Postal Code is Invalid').custom(value=>{
			//checking for valid CANADIAN SIGN UP CODE
			return postcode.validate(req.body.postal,'CA')
		})
		
		let errors = req.validationErrors();
		
		// let errors = req.validationErrors();
		
		if(errors){
			User.findById(chefId).exec((err, chef) => {
				if(err){
					log({error:err.message})
				}
				else{
					res.render('chef_dashboard', {chef: chef, session_user: req.session.user, errors:errors
					})
				}
			})
			
			// res.render('chef_dashboard', {chef: chef, session_user: req.session.user},{
			// 	errors:errors
			// })
			// res.render(('/chefs/'+chefId),{
			// 	errors:errors
			// })
			
		}
		else{
			
			User.findById(chefId).then((chef) => {
				
				// console.log ("Inside findById")
				// console.log (`Printing Chef Object ${chef}`)
				
				
				if (!chef) {
					res.status(404).send()
				}else {
					
					
					// console.log ("passed !chef part")
					//const dishObj = chef.dishes.id(dishId) // Will find the correct dish obj
					//console.log (`The dishObj Found: ${dishObj}`)
					
					chef.set(updatedChefInfo)
					
					chef.save().then((result) => {
						// console.log ("After info was updated")
						// console.log (`Printing updated object again ${chef}`)
						
						//req.flash('success', 'Your Dish Has Been Edited');
						req.flash('success', 'Your information Has Been Updated')	
						res.redirect('/chefs/' + chefId)
						
					}).catch((error) => {
						
						res.status(400).send(error)
					})
					
				}
				
			}).catch((error) => {
				
				res.status(400).send(error)
				
			})
			
			
			
		}
		
		
	});
	
	// ************* END UPDATE YOUR PROFILE *************
	
	app.post('/orders/:id/:dishId', authenticate, function(req, res){
		// res.render('login', {
		//     title: 'Express Login'
		// });
		const customerId = req.params.id
		const dishId = req.params.dishId
		
		//log(`Customer ID: ${customerId}`)
		//log(`Dish ID: ${dishId}`)
		
		//finding the chef via the dishId
		User.findOne({"dishes": {$elemMatch:{'_id':dishId}}},
		function(err,result){
			if(err){
				log(err)
			}else{
				var foundDish = result.dishes.id(dishId)
				
				//Pulling out the dish from chef array
				//i.e no one else can order it now untile Accept or Reject
				//from chef happens
				result.dishes.pull(foundDish)
				result.save((err,doc)=>{
					if(err){
						log({error: err.message})
					}
				})
				
				var chefID = result._id
				//log(`Result of ChefID FOUND: ${chefID}`)
				//log(`Result of DIsh FOUND: ${foundDish}`)
				
				//Adding the order into Chef's order array
				User.findByIdAndUpdate(chefID,
					{$push: {orders:
						{
							customerId: customerId,
							dish : foundDish
						}
						
					}}
					,
					{new: true}
					
					).then((doc)=>{
						//need to grab the order just added above 
						//and add that same to customer order so 
						//its same order including the id
						
						//doc is the chef in this block
						// log(`Doc before latestOrder: ${doc}`)
						// var latestOrder = {'doc.orders':{'$slice',-1}}
						// log(`the latest order addded to chef: ${latestOrder.dish}`)
						
						User.find({_id:doc._id}, {'orders':{'$slice':-1}})
						
						.then((result)=>{
							// log(`result after slice find: ${result}`)
							// log(`order from slice: ${result[0].orders[0]}`)
							var orderToAdd = result[0].orders[0]
							
							//Adding the order into Customer's Order Array
							User.findByIdAndUpdate(customerId,
								{$push: {orders: orderToAdd}},
								{new: true}
								
								).then(()=>{
									// log("ORDERED FINISH< Redirecting!!!!")
									req.flash('success','Your order has been sent to the chef and is now Pending! Please contact the Chef at the number that was provided on the order card')
									// res.redirect('/customers/' + customerId)
									res.status(200).send()
									// return res.status(200)
								})
								.catch((err)=>{
									log({error: err.message})
								})
								
							})
							
							
						})
						.catch((err)=>{
							log({error: err.message})
						})
						
						
					}
				}
				)
				.then((user)=>{
					//log(user)
					
				})
				.catch((err)=>{
					log({error: err.message})
				})
				
				// log("HELLO FROM POST ORDERS");
				
			});
			
			
			// ********************** Change Password chef ********************
			app.post('/Changepass/:id/', authenticate, (req, res) => {
				
				// console.log ("Inside change pass");
				// console.log (req.body);
				// console.log (`ChefID: ${req.params.chefId}`)
				// console.log (`New Pass: ${req.body.newpass}`)
				// console.log (`old pass: ${req.body.oldpass}`)
				
				
				// Getting the required data in the body of req
				// Find the desired order and update the fields
				
				
				//     log ("******** BELOW THIS **********")
				
				
				const chefId = req.params.id
				const NewPass = req.body.newpass
				const OldPass = req.body.oldpass
				
				
				User.findById(chefId).then((chef) => {
					
					
					if (!chef) {
						res.status(404).send()
						// log ("Problem 1")
					}else {
						
						
						bcrypt.compare(req.body.oldpass, chef.password, (err, result) => {
							
							if(err) {
								log({error: err.message})
								// log ("****Problem in comparison****")
								req.flash('danger', "Something Went Wrong")						
								res.redirect('/')
							}
							if(result) {
								
								// log ("****Comparison successful****");
								
								// Create new hashed password
								
								bcrypt.genSalt(10, (error, salt) => {
									bcrypt.hash(req.body.newpass, salt, (err, hash) => {
										
										log (`Hash: ${hash}`)
										
										// Create a new user
										const updatePass = {
											
											password: hash
										}	
										
										chef.set(updatePass) // Set new password here
										
										chef.save().then((result) => {
											// console.log ("After password was updated")
											// console.log (`Printing the result of save: ${chef}`)
											// console.log (`Printing the result of save: ${result}`)
											
											//req.flash('success', 'Your Dish Has Been Edited');
											req.flash('success', 'Your Password Has Been Updated')	
											res.redirect('/chefs/' + chefId)
											
										}).catch((error) => {
											
											// log ("Problem 5")
											
											res.status(400).send(error)
										})
										
									})
								})
								
							}else{
								console.log("User Entered Wrong Password")
								req.flash('danger', 'Invalid Current Password. Try Again.')
								res.redirect('/chefs/' + chefId)
							}
						})
						
					}
				}).catch((error) => {
					
					// log ("Problem 6")
					
					res.status(400).send(error)
					
				})
				
			});
			
			// ****************** Password change ******************
			
			
			// Route for transaction (Chef's dashboard - Accept order)
			
			app.post('/transactions/:id/:orderId', authenticate, function(req, res){
				// res.render('login', {
				//     title: 'Express Login'
				// });
				
				// console.log ("Route for transaction (Chef's dashboard - Accept order)");
				const chefId = req.params.id
				const orderId = req.params.orderId
				
				// log(`Chef ID: ${chefId}`)
				// log(`Order ID: ${orderId}`)
				var customerId, orderFound, foundDish, orderFound2;
				//finding the chef via the dishId
				User.findOne({"orders": {$elemMatch:{'_id':orderId}}},
				function(err,result){
					if(err){
						log(err)
					}else{
						orderFound = result.orders.id(orderId)
						orderFound2 = orderFound
						foundDish = orderFound.dish
						customerId = orderFound.customerId
						
						//Pulling out the dish from chef array
						//i.e no one else can order it now untile Accept or Reject
						//from chef happens
						
						// console.log("order Found");
						// console.log(orderFound);
						
						
						// Find the Customer here and pull the order
						
						result.orders.pull(orderFound)
						result.save((err,doc)=>{
							if(err){
								log({error: err.message})
							}else{
								
							}
						})
						
						//Adding the order into Chef's transac array
						User.findByIdAndUpdate(chefId,
							{$push: {transactions:
								{
									customerId: customerId,
									dish : foundDish
								}
								
							}}
							,
							{new: true}
							
							).catch((err)=>{
								log({error: err.message})
							})
							
							//Adding the order into Customer's trasactions Array
							User.findByIdAndUpdate(customerId,
								{$push: {transactions:
									{
										customerId: customerId,
										dish : foundDish
									}
									
								}},
								{new: true}
								
								).catch((err)=>{
									log({error: err.message})
								})
								
								// Push the dish out of orders for customers
								User.findByIdAndUpdate(customerId,
									{$pull: {orders: orderFound}},
									{new: true}
									
									).then((user) => {
										
										console.log("USER IN THEN");
										// console.log(user);
										// console.log("USER.Orders");
										// console.log(user.order);
										log("Before req.flash 1")
										req.flash('danger', 'You have Accepted the order.')
										res.status(200).send()
										// res.redirect("/chefs/" + chefId)
										// const redirect = "/chefs/" + chefId
										
									}).catch((err)=>{
										log({error: err.message})
									})	
									
									
								} //else end
							}
							)
							.then((user)=>{
								// log(user)
								
								log("Before req.flash 2")
								req.flash('success', 'You have Accepted the order.')
								res.status(200).send()
								
							})
							.catch((err)=>{
								log({error: err.message})
							})
							
							
							
							
							// log("From transaction route");
							res.send("From transaction route");
							
							
						});
						
						app.post('/rejection/:id/:orderId', authenticate, function(req, res){
							// log("in rejection");
							var chefId = req.params.id;
							var orderId = req.params.orderId;
							//1. Find the chef and pull out the order from orders array 
							// and put the 4ish back to his dishes array
							//2. Find the user ie customer, based on the order id
							//3. pull out the order from customer orders and done
							
							//1. 
							var orderedDish, orderToReject;
							
							
							User.findById(chefId)
							.then((chef)=>{
								// log ("Problem 1")
								orderToReject = chef.orders.id(orderId);
								// log(`orderToReject: ${orderToReject}`)
								chef.orders.pull(orderToReject)
								chef.save((err,doc)=>{
									if(err) log({error: err.message})
									// log ("Problem 2")
								})
								chef.dishes.push(orderToReject.dish)
								// log("Chef side done")
								// log ("Problem 3")
								
								//2.
								User.findById(orderToReject.customerId)
								.then((customer)=>{
									//3.
									// log ("Problem 4")
									customer.orders.pull(orderToReject)
									customer.save((err,doc)=>{
										if(err) {
											log({error: err.message})
										}
										else{
											// log ("Problem 5")
											req.flash('warning','You have Rejected the order!')
											// res.redirect('/chefs/'+chefId)
											res.status(200).send()
										}
										
									})
								})
								.catch((err)=>{
									// log ("Problem 6")
									log({error: err.message})
								})
							})
							.catch((err)=>{
								// log ("Problem 7")
								log({error: err.message})
							})
							
							// // {$pull: {orders:{_id: orderId}}},
							// req.flash('danger','Order Rejected Successfully')
							// res.redirect('/chefs/'+chefId)
							
						})
						
						
						
						// ************* Customer UPDATE YOUR PROFILE *************
						
						// Change customer password
						
						app.post('/Changecustpass/:id/', authenticate, (req, res) => {
							
							// console.log ("Inside change pass");
							// console.log (req.body);
							// console.log (`ChefID: ${req.params.chefId}`)
							// console.log (`New Pass: ${req.body.newpass}`)
							// console.log (`old pass: ${req.body.oldpass}`)
							
							
							// Getting the required data in the body of req
							// Find the desired order and update the fields
							
							
							//     log ("******** BELOW THIS **********")
							
							
							const custId = req.params.id
							const NewPass = req.body.newpass
							const OldPass = req.body.oldpass
							
							
							User.findById(custId).then((cust) => {
								
								// console.log ("Inside findById")
								//console.log (`Printing Chef Object ${chef}`)
								
								if (!cust) {
									res.status(404).send()
									// log ("Problem 1")
								}else {
									
									// FOund the chef 
									// Comapre the current passwords for validations 
									
									// log ("Problem 2")
									
									bcrypt.compare(req.body.oldpass, cust.password, (err, result) => {
										
										// log ("***Inside COMPARISON BLOCK")
										
										if(err) {
											log({error: err.message})
											// log ("****Problem in comparison****")
											req.flash('danger', "Something Went Wrong")						
											res.redirect('/')
										}
										if(result) {
											// log ("****Comparison successful****");
											
											// Create new hashed password
											
											bcrypt.genSalt(10, (error, salt) => {
												bcrypt.hash(req.body.newpass, salt, (err, hash) => {
													
													log (`Hash: ${hash}`)
													
													// Create a new user
													const updatePass = {
														
														password: hash
													}	
													
													cust.set(updatePass) // Set new password here
													
													cust.save().then((result) => {
														// console.log ("After password was updated")
														// console.log (`Printing the result of save: ${chef}`)
														// console.log (`Printing the result of save: ${result}`)
														
														//req.flash('success', 'Your Dish Has Been Edited');
														req.flash('success', 'Your Password Has Been Updated')	
														res.redirect('/customers/' + custId)
														
													}).catch((error) => {
														
														// log ("Problem 5")
														
														res.status(400).send(error)
													})
													
												})
											})
											
										}else{
											console.log("User Entered Wrong Password")
											req.flash('danger', 'Invalid Current Password. Try Again.')
											res.redirect('/customers/' + custId)
										}
									})
									
								}
							}).catch((error) => {
								
								res.status(400).send(error)
								
							})
							
						});
						
						// ****************** Password change ******************
						
						// app.post('/rejection/:chefId/:orderId', function(req, res){
						// 	log("in rejection");
						// 	var chefId = req.params.chefId;
						// 	var orderId = req.params.orderId;
						// 	//1. Find the chef and pull out the order from orders array 
						// 	// and put the 4ish back to his dishes array
						// 	//2. Find the user ie customer, based on the order id
						// 	//3. pull out the order from customer orders and done
						
						// 	//1. 
						// 	var orderedDish, orderToReject;
						
						
						// 	User.findById(chefId)
						// 	.then((chef)=>{
						// 		// log ("Problem 1")
						// 		orderToReject = chef.orders.id(orderId);
						// 		// log(`orderToReject: ${orderToReject}`)
						// 		chef.orders.pull(orderToReject)
						// 		chef.save((err,doc)=>{
						// 			if(err) log({error: err.message})
						// 				// log ("Problem 2")
						// 		})
						// 		chef.dishes.push(orderToReject.dish)
						// 		// log("Chef side done")
						// 		// log ("Problem 3")
						
						// 			//2.
						// 			User.findById(orderToReject.customerId)
						// 			.then((customer)=>{
						// 				//3.
						// 				// log ("Problem 4")
						// 				customer.orders.pull(orderToReject)
						// 				customer.save((err,doc)=>{
						// 					if(err) log({error: err.message})
						// 						else{
						// 						// log ("Problem 5")
						// 						req.flash('danger','Order Rejected Successfully')
						// 						res.redirect('/chefs/'+chefId)
						// 					}
						
						// 				})
						// 			})
						// 			.catch((err)=>{
						// 				// log ("Problem 6")
						// 				log({error: err.message})
						// 			})
						
						
						// 		})
						// 	.catch((err)=>{
						// 		// log ("Problem 7")
						// 		log({error: err.message})
						// 	})
						
						
						
						// {$pull: {orders:{_id: orderId}}},
						
						
						// })
						
						
						app.listen(port, () => {
							log(`Listening on port ${port}...`)
						});