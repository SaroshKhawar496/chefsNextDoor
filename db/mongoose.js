const mongoose = require('mongoose')

// connect to our database
mongoose.connect('mongodb://sarosh-chef-next-door:sushi595@ds121105.mlab.com:21105/chefs_next_door_db', { useNewUrlParser: true});

module.exports = { mongoose }
