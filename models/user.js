/* Users model */
const mongoose = require('mongoose')
const validator = require('validator')

const { DishSchema } = require('./dish')
const { OrderSchema } = require('./order')
const { TransSchema } = require('./transactions')
// We'll make this model in a different way
const UserSchema = new mongoose.Schema({
    name: {
		type: String,
		required: true,
		minlength: 2
	},
  
    phone: {
		type: Number,
		required: true,
		minlength: 10
	},
                                       
    postalcode: {
		type: String,
		required: false,
		minlength: 6
	},
  
	email: {
		type: String,
		required: true,
		minlength: 1,
		trim: true, // trim whitespace
		unique: true,
		validate: {
			validator: validator.isEmail,
			message: 'Not valid email'
		}
	},
	password: {
		type: String,
		required: true,
		minlength: 6
	},
	
	usertype: {
		type: String,
		required: true
	},

    dishes: [DishSchema],
    orders: [OrderSchema],
    transactions: [TransSchema]
})

const User = mongoose.model('User', UserSchema)

module.exports = { User }