import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res) => {
   // get user details from front end
   const {username, fullName, email, password} = req.body
   console.log("email:", email)

   // validation - not empty
    if(
        [username, fullName, email, password].some(
            (field)=> field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required to register!!")
    }

   // check if user already exists- username or email
    const userExisted= User.findOne({
        $or: [{ username },{ email }]
    })
    if(userExisted) {
    throw new ApiError(409, "Username or Email already exists")
    }

   // check for images- avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }
   // upload to cloudinary, check avatar uploaded or not
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }
   // create user Object--create entry in DB
   const user= await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    username: username.toLowerCase(),
    password,
    email
   })

// remove password and refresh token filed from response
  const createdUser=  await User.findById(user._id).select(
    "-password -refreshToken"
  )
   
   // check if user is created
   if(!createdUser){
    throw new ApiError(500, "Database error while registering the user")
   }

   // return response
   return res.status(201).json(
        new ApiResponse(200,createdUser, "User registered successfully")
   )
})

export { registerUser }