const mongoose = require("mongoose");

const emergencyContactSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  relation: { type: String, trim: true },
  phone:    { type: String, trim: true },
  priority: { type: Number, default: 1 },
}, { _id: true });
 
const medicalInfoSchema = new mongoose.Schema({
  allergies:     { type: String, trim: true },
  conditions:    { type: String, trim: true },
  bloodPressure: { type: String, trim: true },
  organDonor:    { type: Boolean, default: false },
}, { _id: false });
 
const userProfileSchema = new mongoose.Schema({
  userId:     { type: String, required: true, unique: true, trim: true },
  name:       { type: String, required: true, trim: true },
  dateOfBirth:{ type: String },
  gender:     { type: String, enum: ['Male', 'Female', 'Non-binary', 'Prefer not to say', ''] },
  bloodGroup: { type: String, enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-',''] },
  nationality:{ type: String, trim: true },
  occupation: { type: String, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:      { type: String, trim: true },
  address:    { type: String, trim: true },
  role:       { type: String, default: 'Member' },
  status:     { type: String, default: 'Active' },
  medicalInfo:       { type: medicalInfoSchema, default: () => ({}) },
  emergencyContacts: { type: [emergencyContactSchema], default: [], validate: v => v.length <= 5 },
}, { timestamps: true });
 
const UserProfile = mongoose.model('UserProfile', userProfileSchema);