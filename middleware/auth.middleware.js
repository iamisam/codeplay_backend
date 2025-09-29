import { verifyAccessToken } from "../utils/jwt.js";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ message: "Invalid Token" });
    }
    // Attach user payload to the request object for use in protected routes
    req.user = decoded;
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    // Specifically catch the error for an expired token
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res.status(400).json({ message: "Invalid Token" });
  }
};

export default authMiddleware;
