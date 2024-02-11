import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

//Common Method to generate access and refresh token
const generateAccessAndRefreshToken = async (userId) =>{
    const user = await User.findById(userId)
    const accessToken= user.generateAccessToken()
    const refreshToken= user.generateRefreshToken()
 //Update the value of new refresh token
    user.refreshToken = refreshToken
    await user.save({validateBeforeSave:false})

    return {accessToken,refreshToken}
}
//___End point for registering user
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
    const userExisted= await User.findOne({
        $or: [{ username },{ email }]
    })
    if(userExisted) {
    throw new ApiError(409, "Username or Email already exists")
    }

   // check for images- avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && 
        req.files.coverImage.length > 0){
            coverImageLocalPath = req.files.coverImage[0].path
    }
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

//______End point for logging in user_____
const loginUser = asyncHandler(async(req,res) => {

     //get data from req body
    const {email,username, password} = req.body
     //username or email
     if (!username && !email){
        throw new ApiError(400, "username and email is required")
     }
     //find the user
     const user= await User.findOne({
        $or: [{username},{email}]
     })

     if(!user){
        throw new ApiError(404, "User is not found")
     }
     //password check
     const isPasswordValid = await user.isPasswordCorrect(password)
     if(!isPasswordValid){
        throw new ApiError(401, "Password invalid")
     }
     //access and refresh token
     const {accessToken,refreshToken} = 
        await generateAccessAndRefreshToken(user._id)
    //fetch the updated user from DB
    const loggedinuser = await User.findById(user._id)
                            .select("-password -refreshToken")
     //send cookies
     const options ={
        httpOnly: true,
        secure: true
     }

     //send response
     return res
            .status(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken", refreshToken,options)
            .json(
                new ApiResponse(
                200,
                {
                    user:loggedinuser, accessToken, refreshToken
                },
                "User Logged in sucessfully"
                )
            )
})

//_____End point for logging out user____
const logoutUser = asyncHandler(async (req,res) => {
    //remove refreshToken entry from DB
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken: 1 //this removes refresh tokens from DB
            }
        },
        {
            new:true
        }
        
    )
//clear cookies
const options ={
    httpOnly: true,
    secure: true
 }
res
.status(200)
.clearCookie("accessToken",options)
.clearCookie("refreshToken",options)
.json(new ApiResponse(200,{},"User Loggedout successfully"))





})

//___End point for refreshing REFRESHTOKEN____
const refreshAccessToken= asyncHandler(async(req, res) => {
    const incomingRefreshToken = 
        req.cookie.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorised Refresh token")
    }

    try {
        const decodedToken = 
                jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401, "Unauthorised Refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token has expired")
        }
        const options ={
            httpOnly: true,
            secure: true
         }
    
         //generate new refresh token
         const {accessToken, newRefreshToken} = 
                await generateAccessAndRefreshToken(user?._id)
    
        res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken", newRefreshToken,options)
        .json(
            new ApiResponse(200, 
                {
                    accessToken, refreshToken:newRefreshToken
                },
                "Refresh token refreshed"
                )
        )
    } catch (error) {
        throw new ApiError(401, 
                error?.message || "Invalid Refresh token")
    }
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
 }