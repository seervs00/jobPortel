import { User } from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import getDataUri from "../utils/datauri.js";
import cloudinary from "../utils/cloudinary.js";

export const register = async (req, res) => {
    try {
      const { fullname, email, phoneNumber, password, role } = req.body;
  
      // Validate required fields
      if (!fullname || !email || !phoneNumber || !password || !role) {
        return res.status(400).json({
          message: "All fields are required",
          success: false,
        });
      }
  
      // Validate file upload
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          message: "No file uploaded",
          success: false,
        });
      }
  
      // Convert file to data URI
      const fileUri = getDataUri(file);
      if (!fileUri) {
        return res.status(400).json({
          message: "Failed to process file",
          success: false,
        });
      }
  
      // Upload file to Cloudinary
      const cloudResponse = await cloudinary.uploader.upload(fileUri.content);
      if (!cloudResponse || !cloudResponse.secure_url) {
        return res.status(500).json({
          message: "Failed to upload file to Cloudinary",
          success: false,
        });
      }
  
      // Check if user already exists
      const user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({
          message: "User already exists with this email",
          success: false,
        });
      }
  
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create new user
      await User.create({
        fullname,
        email,
        phoneNumber,
        password: hashedPassword,
        role,
        profile: {
          profilePhoto: cloudResponse.secure_url,
        },
      });
  
      return res.status(201).json({
        message: "Account created successfully",
        success: true,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        message: "Internal server error",
        success: false,
      });
    }
  };
export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        
        if (!email || !password || !role) {
            return res.status(400).json({
                message: "Something is missing",
                success: false
            });
        };
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        }
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.status(400).json({
                message: "Incorrect email or password.",
                success: false,
            })
        };
        // check role is correct or not
        if (role !== user.role) {
            return res.status(400).json({
                message: "Account doesn't exist with current role.",
                success: false
            })
        };

        const tokenData = {
            userId: user._id
        }
        const token = await jwt.sign(tokenData, process.env.SECRET_KEY, { expiresIn: '1d' });

        user = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile
        }

        return res.status(200).cookie("token", token, { maxAge: 1 * 24 * 60 * 60 * 1000, httpsOnly: true, sameSite: 'strict' }).json({
            message: `Welcome back ${user.fullname}`,
            user,
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const logout = async (req, res) => {
    try {
        return res.status(200).cookie("token", "", { maxAge: 0 }).json({
            message: "Logged out successfully.",
            success: true
        })
    } catch (error) {
        console.log(error);
    }
}
export const updateProfile = async (req, res) => {
    try {
        const { fullname, email, phoneNumber, bio, skills } = req.body;
        const file = req.file;
        const userId = req.id; // middleware authentication

        // Find the user
        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found.",
                success: false,
            });
        }

        // Update user data
        if (fullname) user.fullname = fullname;
        if (email) user.email = email;
        if (phoneNumber) user.phoneNumber = phoneNumber;

        // Ensure the profile object exists
        if (!user.profile) {
            user.profile = {};
        }

        // Update profile data
        if (bio) user.profile.bio = bio;
        if (skills) {
            user.profile.skills = skills.split(","); // Convert skills string to array
        }

        // Handle file upload (if a file is provided)
        if (file) {
            const fileUri = getDataUri(file);
            const cloudResponse = await cloudinary.uploader.upload(fileUri.content, {
                resource_type: 'auto', // Handle PDFs and other file types
            });

            // Update resume in profile
            user.profile.resume = cloudResponse.secure_url; // Save the Cloudinary URL
            user.profile.resumeOriginalName = file.originalname; // Save the original file name
        }

        // Save the updated user
        await user.save();

        // Prepare the response
        const updatedUser = {
            _id: user._id,
            fullname: user.fullname,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            profile: user.profile,
        };

        return res.status(200).json({
            message: "Profile updated successfully.",
            user: updatedUser,
            success: true,
        });
    } catch (error) {
        console.error("Error in updateProfile:", error);
        return res.status(500).json({
            message: "Internal server error",
            success: false,
        });
    }
};