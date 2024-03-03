import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import { Like } from "../models/like.model.js"
import { Comment } from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {deleteOnCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"

//*****************************************************/
//Api to get all videos based on input
 //get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    let { page = 1, limit = 10, query, sortBy, 
            sortType, userId } = req.query
   
    const pipeline = []
    //create pipeline to search against title or description
        if(query){
            pipeline.push({
                $search:{
                    index: "video-search",
                    text:{ 
                        query: query,
                        path :["description", "title"]//search based on this 2 parameters
                    }
                }
            })
        }

        //check if user id exists and is valid userId
    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(403, "Invalid User")
        }
    }
    //if valid userid then fliter on userId
    pipeline.push({
        $match:{
            owner: new mongoose.Types.ObjectId(userId)
        }
    })

    //filter out only isPublished=true videos
    pipeline.push({
        $match: {
            isPublished: true
        }
    })

// add sortby and sort order on pipeline
if(sortBy && sortType){
    pipeline.push({
        $sort:{
            [sortBy]: sortType === "asc"? 1 : -1
        }
    })
}else{ // defaults descending with createdAt--Latest first
    pipeline.push({
        $sort:{
            createdAt: -1
        }
    })
}

//get owner details and unwind
pipeline.push({
    $lookup:{
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetails",
        pipeline:[
            {
                $project:{
                    username: 1,
                    avatar: 1
                }
            }
        ]
    }
},
{  //unwind Owner
    $unwind: "$ownerDetails"
})

//execute aggregate pipeline
const videoAggregate = await Video.aggregate(pipeline)

//parse to Int as the format was String
const options = {
    page: parseInt(page),
    limit: parseInt(limit)
}

const video = await Video.aggregatePaginate(videoAggregate,options)

return res
       .status(200)
       .json(new ApiResponse(200, video, "Videos fetched succesfully"))

})

//*****************************************************/
// API to get video, upload to cloudinary, create video
const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
//check if title or description is empty
    if([title,description].some(field => field.trim() === "")){
        throw new ApiError(403, "All fields are required")
    }
const videoFilePath = req.files?.video[0]?.path;
const thumbnailFilePath = req.files?.thumbnail[0]?.path;

if(!videoFilePath){
    throw new ApiError(403, "Video local path is required")
}

if(!thumbnailFilePath){
    throw new ApiError(403, "Thumbnail local path is required")
}

// upload video on cloudinary
const videoFile = await uploadOnCloudinary(videoFilePath)
const thumbnail = await uploadOnCloudinary(thumbnailFilePath)

if(!videoFile){
    throw new ApiError(403, "Video is not found")
}

if(!thumbnail){
    throw new ApiError(403, "Thumbnail is not found")
}

//save video details on DB
const video = await Video.create({
    title,
    description,
    videoFile: {
        url: videoFile.url,
        public_id : videoFile.public_id
    },
    thumbnail: {
        url: thumbnail.url,
        public_id : thumbnail.public_id
    },
    owner: req.user?._id,
    isPublished: true,
    duration: videoFile.duration
})

const videoId = await Video.findById(video._id)

if(!videoId){
    throw new ApiError(403, "Something went wrong while saving data")
}

//send response
res
.status(200)
.json(new ApiResponse(200, video, "Video saved successfully!!"))

})

//*****************************************************/
// get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
     if(!isValidObjectId(videoId)){
        throw new ApiError(403, "Invalid Video Id")
     }

     //fetch videos by videoId
     const video = await Video.findById({
        _id: videoId
     }).populate({
        path: "owner",
        select: "username email fullName"
     })

     if(!video){
        throw new ApiError(404, "Video not found")
     }
     //increment view count after fetch
     video.views += 1
     video.save({validateBeforeSave: false})

     //update watchHistory with this Video for User
     await User.findByIdAndUpdate(req.user?._id, {
        $addToSet:{
            watchHistory: videoId
        }
     })

     res
     .status(200)
     .json(new ApiResponse(200, video, "Video fetched successfully!!"))
 
})

//*****************************************************/
//Update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const {title, description} = req.body

    if(!isValidObjectId(videoId)){
        throw new ApiError(402, "Video Id is not valid")
    }

    if([title, description].some(field => field.trim() === "")){
        throw new ApiError(403, "Title and description is required")
    }

    const loggedInUser = req.user?._id

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(403, "Error!Video details not fetched")
    }

    if(loggedInUser.toString() !== video.owner.toString()){
        throw new ApiError(400, "Youa are not authorised to update this video")
    }

    const thumbnailTobeDeleted = video.thumbnail.public_id
    const newThumbnailLocalPath = req.files?.path

    if(newThumbnailLocalPath){
        throw new ApiError(403, "Thumbnail is required")
    }

    const thumbnail = await uploadOnCloudinary(newThumbnailLocalPath)

    if(!thumbnail){
        throw new ApiError(402, "Error on uploading thumbnail on Cloudinary")
    }

    const updateVideo = await Video.findByIdAndUpdate(videoId, {
        $set:{
            title,
            description,
            thumbnail: {
                url: thumbnail.url,
                public_id: thumbnail.public_id
            }
        }
    },
    {new: true}
    )
    
   if (updateVideo){
        await deleteOnCloudinary(thumbnailTobeDeleted) 
   }else {
        throw new ApiError(403, "Error on updating video")
   }

res
.status(200)
.json(
    new ApiResponse
    (200, updateVideo, "Video details updated succesfully"))
})

//*****************************************************/
 // delete video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    const loggedInUser = req.user?._id

    if(!isValidObjectId){
        throw new ApiError(401, "Invalid Video Id")
    }

    //fetch video details based on Video Id
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(402, "No Video found")
    }

    //check if user is authroised to delete this video
    if(video.owner.toString() !== loggedInUser.toString()){
        throw new ApiError(402, "You are not authorised to delete this video")
    }

    //If authorised delete video
    const deleteVideo = await Video.findByIdAndDelete(video?._id)

    if(!deleteVideo){
        throw new ApiError(403, "Video cannot be deleted!!")
    }

    //delete from cloudinary
    await deleteOnCloudinary(video.thumbnail.public_id)
    //pass type as "video" as default is "image" on deleteOnCloudinary util
    await deleteOnCloudinary(video.videoFile.public_id, "video")

    //delete Likes for this video
    await Like.deleteMany({
        video: videoId
    })

    //delete Comments for this video
    await Comment.deleteMany({
        video: videoId
    })

    //send response
    res.status(200)
    .json(new ApiResponse(200,{}, "Video deleted succesfully"))
   
})

//*****************************************************/
//toggle isPublished status
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if(!isValidObjectId(videoId)){
        throw ApiError(400, "Invalid Video Id")
    }

    //fetch video details
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(402, "Video not found")
    }

    // check if user is authorised to make the changes
    if(video.owner.toString()!== req.user?._id){
        throw new ApiError(402, "Unauthorised Access!!")
    }

    //update toggle status
    const toggleStatus = await Video.findByIdAndUpdate(videoId, {
        $set:{
            isPublished: !video?.isPublished
        }
    },{new: true})

    if(!toggleStatus){
        throw new ApiError(402, "Error while updating toggle Status")
    }

    //send response
    res.status(200)
    .json(new ApiResponse(
        200, {isPublished:toggleStatus.isPublished}, 
        "Toggle status updated successfully"))

})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}