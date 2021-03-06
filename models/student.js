const mongoose = require('mongoose')

const Student = mongoose.model('Student', {
	name: {
		type: String,
		required: true,
		minlength: 1,
		trim: true, // trim whitespace
		unique: true
	}, 
	year: {
		type: Number,
		required: true
	}
})

module.exports = { Student }
