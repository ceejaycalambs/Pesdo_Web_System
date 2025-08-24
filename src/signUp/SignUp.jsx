import React, { useState } from "react";
import { FaUser, FaEnvelope, FaLock, FaBuilding, FaEye, FaEyeSlash } from "react-icons/fa";
import "./SignUp.css";

const SignUp = () => {
  const [role, setRole] = useState("jobseeker");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="center-container">
      <form className="form">
        <p className="title">Register</p>
        <p className="message">Signup now and get full access to our app.</p>

        <div className="role-selection">
          <label>
            <input
              type="radio"
              name="role"
              value="jobseeker"
              checked={role === "jobseeker"}
              onChange={() => setRole("jobseeker")}
            />
            Job Seeker
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="employer"
              checked={role === "employer"}
              onChange={() => setRole("employer")}
            />
            Employer
          </label>
        </div>

        <div className="flex">
          <label>
            <FaUser className="icon" />
            <input className="input" type="text" required placeholder="First name" />
          </label>
          <label>
            <FaUser className="icon" />
            <input className="input" type="text" required placeholder="Last name" />
          </label>
        </div>

        <label>
          <FaEnvelope className="icon" />
          <input className="input" type="email" required placeholder="Email" />
        </label>

       <label className="password-container">
  <FaLock className="icon" />
  <input
    className="input"
    type={showPassword ? "text" : "password"}
    required
    placeholder="Password"
  />
  <span
    className="password-toggle"
    onClick={() => setShowPassword(!showPassword)}
  >
    {showPassword ? <FaEye /> : <FaEyeSlash />} {/* Fixed the icon toggle */}
  </span>
</label>

<label className="password-container">
  <FaLock className="icon" />
  <input
    className="input"
    type={showConfirmPassword ? "text" : "password"}
    required
    placeholder="Confirm password"
  />
  <span
    className="password-toggle"
    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
  >
    {showConfirmPassword ? <FaEye /> : <FaEyeSlash />} {/* Fixed the icon toggle */}
  </span>
</label>


        <div className={`extra-fields ${role === "employer" ? "show" : ""}`}>
          {role === "employer" && (
            <>
              <label>
                <FaBuilding className="icon" />
                <input className="input" type="text" required placeholder="Company Name" />
              </label>
              <label>
                <FaBuilding className="icon" />
                <input className="input" type="text" required placeholder="Company Address" />
              </label>
            </>
          )}
        </div>

        <button type="submit" className="submit">
          Submit
        </button>

        <p className="signin">
          Already have an account? <a href="/login">Sign in</a>
        </p>
      </form>
    </div>
  );
};

export default SignUp;
