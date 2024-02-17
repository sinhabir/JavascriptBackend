import { Router } from "express";
import { getCurrentUser, 
        getUserChannelProfile, 
        getWatchHistory, 
        loginUser, 
        logoutUser, 
        refreshAccessToken, 
        registerUser, 
        updateAccountDetails, 
        updateUserAvatar, 
        updateUserCoverImage 
    } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js"
import { jwtverify } from "../middlewares/auth.middleware.js";

const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name:"avatar",
            maxCount: 1
        },
        {
            name:"coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

//login router
router.route("/login").post(loginUser)

//logout router
router.route("/logout").post(jwtverify,logoutUser)

//Refresh Token refresh
router.route("/refresh-token").post(refreshAccessToken)
router.route("/current-user").get(jwtverify, getCurrentUser)
router.route("/update-account").patch(jwtverify, updateAccountDetails)
router.route("/avatar").patch(
    jwtverify, upload.single("avatar") ,updateUserAvatar)
router.route("/cover-image").patch(
    jwtverify, upload.single("coverImage"), updateUserCoverImage)

router.route("/channel/:username").get(jwtverify,getUserChannelProfile)
router.route("/history").get(jwtverify, getWatchHistory)


export default router