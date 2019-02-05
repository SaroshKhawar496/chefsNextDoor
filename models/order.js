const mongoose = require('mongoose')
const { DishSchema } = require('./dish')

const OrderSchema = new mongoose.Schema({
	customerId: {
		type: String
	},
	dish: DishSchema

})

// const Order = mongoose.model('Order', OrderSchema)

module.exports = { OrderSchema }