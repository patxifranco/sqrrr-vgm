/**
 * One-time exploit penalty script for Kelmi
 *
 * This script deducts exploited coins from Kelmi and adds them to his debt.
 * Run with: node tools/penalize-kelmi.js
 *
 * Requires MONGODB_URI environment variable or uses default localhost.
 */

const mongoose = require('mongoose');

// MongoDB connection - use same as server.js
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sqrrr';

// User Schema (must match server.js)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  profilePicture: { type: String, default: 'profiles/default.svg' },
  coins: { type: Number, default: 1000 },
  debt: { type: Number, default: 0 },
  exploitPenaltyApplied: { type: Boolean, default: false },
  cards: { type: Map, of: Number, default: {} },
  lastFreeCard: { type: Number, default: null },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesGuessed: { type: Number, default: 0 },
    superSonics: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    gameHistory: { type: Map, of: Number, default: {} }
  },
  sqrrrdle: {
    guesses: { type: [String], default: [] },
    currentDayStatus: { type: String, default: 'playing' },
    currentDayKey: { type: String, default: null }
  }
});

const User = mongoose.model('User', userSchema);

// Configuration
const TARGET_USERNAME = 'kelmi';
const COINS_TO_LEAVE = 0; // Leave him with 0 coins

async function penalizeKelmi() {
  console.log('\n========================================');
  console.log('   KELMI EXPLOIT PENALTY SCRIPT');
  console.log('========================================\n');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.\n');

    // Find Kelmi (case-insensitive)
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${TARGET_USERNAME}$`, 'i') }
    });

    if (!user) {
      console.log(`ERROR: User "${TARGET_USERNAME}" not found in database.`);
      return;
    }

    // Current state
    const currentCoins = user.coins ?? 0;
    const currentDebt = user.debt ?? 0;

    console.log('CURRENT STATE:');
    console.log(`  Username: ${user.username}`);
    console.log(`  Coins: ${currentCoins.toLocaleString()} $qr`);
    console.log(`  Debt: ${currentDebt.toLocaleString()} $qr`);
    console.log(`  Exploit Penalty Applied: ${user.exploitPenaltyApplied ?? false}`);
    console.log('');

    // Calculate penalty
    const penaltyAmount = currentCoins - COINS_TO_LEAVE;

    if (penaltyAmount <= 0) {
      console.log('No penalty needed - coins already at or below target.');
      return;
    }

    // Apply penalty
    console.log('APPLYING PENALTY:');
    console.log(`  Deducting: ${penaltyAmount.toLocaleString()} $qr`);
    console.log(`  Adding to debt: ${penaltyAmount.toLocaleString()} $qr`);
    console.log(`  Remaining coins: ${COINS_TO_LEAVE.toLocaleString()} $qr`);
    console.log('');

    // Update user
    user.coins = COINS_TO_LEAVE;
    user.debt = currentDebt + penaltyAmount;
    user.exploitPenaltyApplied = true;

    await user.save();

    // Verify
    const verifyUser = await User.findOne({
      username: { $regex: new RegExp(`^${TARGET_USERNAME}$`, 'i') }
    });

    console.log('NEW STATE (VERIFIED):');
    console.log(`  Username: ${verifyUser.username}`);
    console.log(`  Coins: ${verifyUser.coins.toLocaleString()} $qr`);
    console.log(`  Debt: ${verifyUser.debt.toLocaleString()} $qr`);
    console.log(`  Exploit Penalty Applied: ${verifyUser.exploitPenaltyApplied}`);
    console.log('');

    console.log('========================================');
    console.log('   PENALTY APPLIED SUCCESSFULLY');
    console.log('========================================\n');

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

// Run the script
penalizeKelmi();
