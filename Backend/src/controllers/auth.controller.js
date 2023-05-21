const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Patient = require("../models/Patient");
const bcrypt = require("bcrypt");
const ResetToken = require("../models/ResetToken");
const { createToken } = require("../utils/jwt");
const encriptPass = require("../utils/bcrypt");

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "c7c79d6f30b9f0",
    pass: "0fdb5af0252b71",
  },
});

const login = async (req, res) => {
  const { personalId, password } = req.body;

  try {
    if (!personalId || !password) {
      return res.status(400).json({
        ok: false,
        message: "Debe proporcionar un ID personal y una contraseña..",
      });
    }
    const patient = await Patient.findOne({ personalId });

    if (!patient) {
      return res.status(403).json({
        ok: false,
        message: "Credenciales Invalidas",
      });
    }

    const isMatch = await bcrypt.compare(password, patient.password);
    if (!isMatch) {
      return res.status(403).json({
        ok: false,
        message: "Credenciales Invalidas",
      });
    }

    const accessToken = createToken({ _id: patient._id });

    return res.status(200).json({
      ok: true,
      message: "Autenticacion correcta",
      user: { name: patient.name },
      accessToken,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error del servidor",
      error,
    });
  }
};
const register = async (req, res) => {
  const data = req.body;
  console.log(data);
  try {
    if (!data.personalId || !data.password) {
      return res.status(400).json({
        ok: false,
        message: "Debe proporcionar un ID personal y una contraseña..",
      });
    }
    const foundUser = await Patient.findOne({ personalId: data.personalId });
    if (foundUser) {
      return res.status(400).json({
        ok: false,
        message: "PersonalId ya está registrado.",
      });
    }
    const newUser = new Patient({
      name: data.name,
      password: await encriptPass(data.password),
      email: data.email,
      personalId: data.personalId,
      phoneNumber: data.phoneNumber,
      birthDay: data.birthDay,
      gender: data.gender,
      address: data.address,
    });
    const savedNewUser = await newUser.save();
    return res.status(200).json({
      ok: true,
      message: "Registro Exitoso",
      user: savedNewUser,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error del servidor",
      error,
    });
  }
};

const me = async (req, res) => {
  try {
    const foundUser = await Patient.findById(req.user._id);
    return res.status(200).json({
      ok: true,
      data: foundUser,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error del servidor. Razón: " + error.message,
    });
  }
};
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await Patient.findOne({ email });
    if (!user) {
      res.status(404).json({
        ok: false,
        message: "No se encontró el usuario",
      });
      return;
    }

    // Crea un token de restablecimiento de contraseña
    const token = new ResetToken({
      userId: user._id,
      token: crypto.randomBytes(16).toString("hex"),
    });
    await token.save();

    // Envía un correo electrónico con el enlace de restablecimiento de contraseña
    const resetUrl = `${process.env.FRONT_URL}/confirmPassword?token=${token.token}`;

    await transporter.sendMail({
      from: "NoCountry@gmail.com",
      to: user.email,
      subject: "Restablecer contraseña",
      html: `<p>Hola ${user.name},</p><p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Si no solicitaste esto, no hagas nada y tu contraseña permanecerá igual.</p>`,
    });

    res.status(200).json({
      ok: true,
      message: "Se envió un correo electrónico para restablecer la contraseña",
      resetUrl,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message:
        "Error al enviar el correo electrónico de restablecimiento de contraseña",
    });
  }
};
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Busca el token
    const tokenDoc = await ResetToken.findOne({ token });

    if (!tokenDoc) {
      res.status(404).json({
        ok: false,
        message: "El token no es válido o ha expirado",
      });
      return;
    }

    // Busca al usuario y actualiza la contraseña
    const user = await Patient.findById(tokenDoc.userId);
    if (!user) {
      res.status(404).json({
        ok: false,
        message: "No se encontró el usuario",
      });
      return;
    }
    user.password = await encriptPass(password);

    await user.save();
    // Elimina el token
    await ResetToken.deleteOne({ token: tokenDoc.token });

    return res.status(200).json({
      ok: true,
      message: "Se restableció la contraseña con éxito",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "Error del servidor. Razón: " + error.message,
    });
  }
};
module.exports = {
  login,
  register,
  me,
  forgotPassword,
  resetPassword,
};
