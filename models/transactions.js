// Transaction Schema - Temporary for handling the accept and reject orders

const mongoose = require('mongoose')
const { DishSchema } = require('./dish')

const TransSchema = new mongoose.Schema({
	customerId: {
		type: String
	},
	dish: DishSchema

})

module.exports = { TransSchema }