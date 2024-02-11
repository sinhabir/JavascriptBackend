import { Router } from "express";
import { loginUser, logoutUser, refreshAccessToken, registerUser } from "../controllers/user.controller.js";
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

export default router