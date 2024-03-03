import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//***********************************/
//Create tweet
const createTweet = asyncHandler(async (req, res) => {
    const { content } = req.body

    if(!content){
        throw new ApiError(401, "Content is required")
    }

    const tweet = await Tweet.create({
        content,
        owner: req.user?._id
    })

    if(!tweet){
        throw new ApiError(500, "failed to create tweet")
    }

    res.status(200)
    .json(new ApiResponse(200, tweet, "Tweet created succesfully"))

})

//***********************************/
// Get user tweets
const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "User Id is not valid")
    }

    //fetch tweet details along with like count and Owner details
    const tweets = await Tweet.aggregate([
        {
            $match:{
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
                pipeline: [
                    {
                        $project:{
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $lookup:{
                from: "likes",
                localField: "_id",
                foreignField:"tweet",
                as:"likeDetails",
                pipeline:[
                    {
                        $project:{
                            likedBy: 1
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                likesCount:{
                    $size: "$likeDetails"
                },
                ownerDetails:{
                    $first: "$ownerDetails"
                }

            }
        },
        {
            $sort:{
                createdAt :-1
            }
        },
        {
            $project:{
                content: 1,
                ownerDetails: 1,
                likesCount: 1,
                createdAt: 1
            }
        }
    ])

    if(!tweets){
        throw new ApiError(500, "Error while fetching tweet details")
    }

    res.status(200)
    .json(new ApiResponse(200, tweets, "Tweets fetched succesfully"))

})

//***********************************/
 // update tweet
const updateTweet = asyncHandler(async (req, res) => {
   const { content } = req.body
   const { tweetId } = req.params

   if(!content){
    throw new ApiError(400, "Content is required to update")
   }

   if(!isValidObjectId(tweetId)){
    throw new ApiError(401, "Tweet Id is invalid")
   }

   //fetch tweet data
   const tweet = await Tweet.findById(tweetId)

   if(!tweet){
    throw new ApiError(500, "Tweet cannot be fetched")
   }

   if(tweet.owner.toString() !== req.user?._id.toString()){
    throw new ApiError(400, "Unauthorised to make changes")
   }

   const updateTweet = await Tweet.findByIdAndUpdate(tweetId,{
        $set:{
            content,
        }
   }, {new : true})

   if(!updateTweet){
     throw new ApiError(500, "Tweet cannot be updated")
   }

   res.status(200).
   json(new ApiResponse(200, updateTweet, "Tweet updated Succesfully"))

})


//***********************************/
// Delete tweet
const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId }    = req.params

    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Tweet Id is Invalid")
    }
    
    //fetch tweet details
    const tweet = await Tweet.findById(tweetId)

    if(!tweet){
        throw new ApiError(500, "Tweet cannot be fetched")
    }

    if(tweet.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "Unauthorised to make changes")
       }

    const deleteTweet = await Tweet.findByIdAndDelete(tweetId)

    if(!deleteTweet){
        throw new ApiError(500, "Tweet cannot be deleted")
    }

    res.status(200)
    .json(new ApiResponse(500,{}, "Tweet deleted succesfully"))
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}