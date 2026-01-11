const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sqrrr';

// User Schema (must match server.js)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  profilePicture: { type: String, default: 'profiles/default.svg' },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesGuessed: { type: Number, default: 0 },
    superSonics: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    gameHistory: { type: Map, of: Number, default: {} }
  }
});

const User = mongoose.model('User', userSchema);

// Record Schema
const recordSchema = new mongoose.Schema({
  songKey: { type: String, required: true, unique: true },
  player: { type: String, required: true },
  time: { type: Number, required: true },
  date: { type: Number, required: true }
});

const Record = mongoose.model('Record', recordSchema);

async function resetDatabase() {
  console.log('\n=== SQRRR Database Reset ===\n');

  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Reset all user stats
    const userResult = await User.updateMany({}, {
      $set: {
        'stats.gamesPlayed': 0,
        'stats.gamesGuessed': 0,
        'stats.superSonics': 0,
        'stats.hintsUsed': 0,
        'stats.totalPoints': 0,
        'stats.gameHistory': {}
      }
    });
    console.log(`Reset stats for ${userResult.modifiedCount} users`);

    // Delete all records
    const recordResult = await Record.deleteMany({});
    console.log(`Deleted ${recordResult.deletedCount} song records`);

    console.log('\n✓ Database reset complete!\n');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetDatabase();
