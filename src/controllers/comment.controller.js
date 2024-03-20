import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {Video} from "../models/video.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//***************************************************/
//get all comments for a video
const getVideoComments = asyncHandler(async (req, res) => {

    const {videoId} = req.params
    const {page = 1, limit = 10} = req.query

    const commentsAggregate = await Comment.aggregate([
        {
            $match:{
                video: new mongoose.Types.ObjectId(videoId)
            }
        },
        {
           $lookup:{
                from: "users",
                localField: "owner",
                foreignField:"_id",
                as: "ownerDetails"
           } 
        },
        {
            $lookup:{
                from:"likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes"
            }
        },
        {
            $addFields:{
                likesCount:{
                    $size: "$likes"
                },
                owner:{
                    $first: "$owner"
                },
                
                    isLiked:{
                        $cond:{
                            if:{$in: [req.user?._id, "$likes.likedBy"]},
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $sort: {
                    createdAt: -1
                }
            },
            { 
                    $project: {
                        content: 1,
                        createdAt: 1,
                        likesCount: 1,
                        owner: {
                            username: 1,
                            fullName: 1,
                            "avatar.url": 1
                        },
                        isLiked: 1
                    }
            }        
    ])

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
    };

    const comments = await Comment.aggregatePaginate(
        commentsAggregate,
        options
    )

    return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));

})

//***************************************************/
 // Add a comment to a video
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const { content } = req.body

    if(!content){
        throw new ApiError(400, "Content is required")
    }

    //check for video 
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video doesnot exists")
    }

    //create comment for the video
    const videoOnComment = await Comment.create({
        content,
        video: videoId,
        owner: req.user?._id
    })

    if(!videoOnComment){
        throw new ApiError(500, "Failed to add comments")
    }
    
    return res.status(200)
        .json(new ApiResponse
            (200, videoOnComment, "Comment added succesfully!!"))
   
})

//***************************************************/
// Update a comment
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    const { content } = req.body

    if(!content){
        throw new ApiError(400, "Content is required")
    }

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(400, "Comment doesnot exists")
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        comment?._id,
        {
            $set:{
                content
            }
        },{new: true}
    )

    if(!updatedComment){
        throw new ApiError(500, "Comment update failed")
    }

    res.status(200)
    .json(new ApiResponse(
        200, updateComment, "Comments updated succesfully"))
    
})

//***************************************************/
  // Delete a comment
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params

    const comment = await Comment.findById(commentId)

    if(!comment){
        throw new ApiError(400, "Comment not found")
    }

    if(comment?.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "Unauthorised User!!")
    }
    await Comment.findByIdAndDelete(comment._id)

    await Like.deleteMany({
        comment: commentId,
        likedBy: req.user?._id
    })

    res.status(200)
    .json(new ApiResponse(
        200, commentId, "Comment Deleted sucessfully "))
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
     deleteComment
    }