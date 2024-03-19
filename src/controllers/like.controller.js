import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//**************************************/
//Toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Not a valid video Id")
    }

    //check if video already liked
    const alreadyLiked = await Like.findOne({
        video: videoId,
        likedBy: req.user?._id
    })

    //if exists then delete
    if(alreadyLiked){
        await Like.findByIdAndDelete(alreadyLiked?._id)

        return res.status(200)
            .json(new ApiResponse(200, {isLiked: false}))
    }
    //create if doesnot exists
    await Like.create({
        video: videoId,
        likedBy: req.user?._id
    })

    return res.status(200).json(new ApiResponse(200, {isLiked: true}))
 
})

//**************************************/
//Toggle like on comment
const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params

    if(!isValidObjectId(commentId)){
        throw new ApiError(400, "Comment id is invalid")
    }

    const likedComment = await Like.findOne({
        comment: commentId,
        likedBy: req.user?._id
    })    

    if(likedComment){
        await Like.findByIdAndDelete(likedComment?._id)

        res.status(200).json(new ApiResponse(200, {isLiked: false}))
    }

    await Like.create({
        comment: commentId,
        likedBy: req.user?._id
    })

    res.status(200).json(new ApiResponse(200, {isLiked: true}))

})

//**************************************/
//Toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if(!isValidObjectId(tweetId)){
        throw new ApiError(400, "Tweet id is invalid")
    }

    const likedTweet = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user?._id
    })    

    if(likedTweet){
        await Like.findByIdAndDelete(likedComment?._id)
        
        res.status(200).json(new ApiResponse(200, {isLiked: false}))
    }

    await Like.create({
        tweet: tweetId,
        likedBy: req.user?._id
    })

    res.status(200).json(new ApiResponse(200, {isLiked: true}))  
}
)

//**************************************/
//Get all liked videos
const getLikedVideos = asyncHandler(async (req, res) => {

    const likedVideos = await Like.aggregate([
        {
            $match:{
                likedBy: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "video",
                foreignField: "_id",
                as: "likedVideos",
                pipeline: [
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as:"ownerDetails"
                        }
                    },
                    {
                        $unwind: "ownerDetails"
                    }
                ]
            }
        },
       {
        $unwind: "likedVideos"
       },
       {
        $sort:{
            createdAt: -1
        }
       },
       {
        $project:{
            _id: 0,
            likedVideos:{
                _id: 1,
                "videoFile.url": 1,
                "thumbnail.url": 1,
                owner: 1,
                title: 1,
                description: 1,
                views: 1,
                duration: 1,
                createdAt: 1,
                isPublished: 1,
                ownerDetails: {
                    username: 1,
                    fullName: 1,
                    "avatar.url": 1,
                },
            }
        }
       }
    ])

    return res.status(200)
    .json(new ApiResponse
        (200, likedVideos, "Liked videos details fetched succesfully") )

})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}