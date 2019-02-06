require('dotenv').config();

const mongoose = require('mongoose')

// connect to our database
mongoose.connect('mongodb://'+process.env.DB_USER_NAME+':'+process.env.DB_PWD+'@ds121105.mlab.com:21105/'+process.env.DB_NAME, { useNewUrlParser: true});

module.exports = { mongoose }
