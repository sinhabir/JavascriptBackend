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
        req.cookies.refreshToken || req.body.refreshToken

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

//___Endpoint for Resetting Password___
const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect= 
        await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401,"Password Incorrect")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
          .status(200)
          .json( new ApiResponse(200,{},"password changed successfully"))

})

//___Endpoint to get Current User
const getCurrentUser = asyncHandler(async(req,res) => {
    return res
           .status(200)
           .json(new ApiResponse(200,req.user, "Current user fetched succesfully"))
})

//____Endpoint for Updating Accout details-Email , Fullname
const updateAccountDetails = asyncHandler(async(req,res) => {
    const{fullName, email} = req.body

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
            fullName,
            email
            }
        }, 
        {new:true}
        ).select("-password")

    return res.status(200)
          .json(new ApiResponse(200, user, "Account updated succesfully"))
})

//___Endpoint for Updating avatar
const updateUserAvatar = asyncHandler(async(req, res)=>{
    const avatarLocalPath= req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar= await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading Avatar on Cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new : true}
    ).select("-password")

 return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar uploaded sucessfully"))

})


//___Endpoint for Updating Coverimage
const updateUserCoverImage = asyncHandler(async(req, res)=>{
    const coverImageLocalPath= req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"CoverImage file is missing")
    }

    const coverImage= await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading Coverimage on Cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new : true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage uploaded sucessfully"))

})

//__Endpoint to get user channel details
const getUserChannelProfile = asyncHandler(async(req,res)=> {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Usrrname is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username: username.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"

            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"

            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"$subscribers"
                },
                channelSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }

            }
        },
        { $project:
            {
            fullName: 1,
            username: 1,
            subscribersCount: 1,
            channelSubscribedToCount: 1,
            isSubscribed: 1,
            avatar: 1,
            coverImage: 1,
            email: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel doesnot exists")
    }

    return res
           .status(200)
           .json(
            new ApiResponse
                (200, channel[0], 
                "Channel details fetched successfully")
                )
})


export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile
 }