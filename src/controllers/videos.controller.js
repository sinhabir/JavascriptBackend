import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"

//Api to get all videos based on input
const getAllVideos = asyncHandler(async (req, res) => {
    let { page = 1, limit = 10, query, sortBy, 
            sortType, userId } = req.query
    //get all videos based on query, sort, pagination
    const pipeline = []
    //create pipeline to search against title or description uuuuu
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
const videAggregate = await Video.aggregate(pipeline)

//parse to Int as the format was String
const options = {
    page: parseInt(page),
    limit: parseInt(limit)
}

const video = await Video.aggregatePaginate(videAggregate,options)

return res
       .status(200)
       .json(new ApiResponse(200, video, "Videos fetched succesfully"))

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}