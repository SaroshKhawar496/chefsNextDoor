const mongoose = require('mongoose')

const DishSchema = new mongoose.Schema({
	title: {
		type: String,
		required: true,
		minlength: 1,
		trim: true, // trim whitespace
		unique: false
	}, 
	description: {
		type: String,
		required: true
	},
  
    price: {
		type: Number,
		required: true
	},
	
//	chefId: {
//      type: mongoose.Schema.Types.ObjectId, ref: 'User',
//      required: true
//    },
  
    imageURL: {
      type: String,
      required: true
    }
})

//const Dish = mongoose.model('Dish', DishSchema)

module.exports = { DishSchema }