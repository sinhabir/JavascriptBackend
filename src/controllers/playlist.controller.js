import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

//***********************************************/
//create playlist
const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body

    if(!(name && description)){
        throw new ApiError(400, "name and description is required")
    }

    //create playlist
    const createPlaylist = await Playlist.create({
        name,
        description,
        owner: req.user?._id
    })
    
    if(!createPlaylist){
        throw new ApiError(500, "Playlist cannot be created")
    }

    return res.status(200)
        .json(new ApiResponse
            (200, createPlaylist, "Playlist created succesfully"))  
})

//***********************************************/
//Get user playlists
const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params

    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Not a valid User id")
    }

    const userplaylists = await Playlist.aggregate([
        {
            $match:{
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos"
            }
        },
        {
            $addFields:{
                totalVideos:{
                    $size: "$videos"
                }
            }
        },
        {
            $project:{
                _id: 1,
                name: 1,
                description: 1,
                totalVideos : 1
            }
        }
    ])

    if(userplaylists?.length() < 0){
        throw new ApiError(500, "User playlist cannot be fetched")
    }

    return res.status(200)
        .json(new ApiResponse(
            200, userplaylists[0], 
            "User Playlists details fetched succesfully"))
    
})

//***********************************************/
 //Get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Playlist Id is invalid")
    }

    const getPlaylist = await Playlist.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField: "owner",
                foreignField:"_id",
                as: "owner",
                pipeline:[
                    {
                        $project:{
                           username: 1,
                           fullName: 1,
                           avatar: 1 
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                owner:{
                    $first: "$owner"
                }
            }
        },
        {
            $lookup:{
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline:[
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline:[
                                {
                                    $project:{
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        },
       {
        $addFields:{
            videos: {
                $first: "$videos"
            }
        }
       }
    ])

    if(!getPlaylist?.length()< 0){
        throw new ApiError(400, "Details cannot be fetched"  )
    }

    return res.status(200).json(
        new ApiResponse
        (200, getPlaylist[0], "Playlist details fetched sucessfully"))
   
})

//***********************************************/
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
})

//***********************************************/
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist

})

//***********************************************/
const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}