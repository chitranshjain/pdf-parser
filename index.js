const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const request = require("request");
const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} = require("firebase/storage");
const mongoose = require("mongoose");
const multer = require("multer");
const PDFParser = require("pdf2json");

const app = express();
app.use(cors());
app.use(bodyParser.json());
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.FIREBASEKEY,
  authDomain: process.env.AUTHDOMAIN,
  projectId: process.env.PROJECTID,
  storageBucket: process.env.STORAGE,
  messagingSenderId: process.env.SENDERID,
  appId: process.env.APPID,
};

const firebaseApp = initializeApp(firebaseConfig);
const uploader = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 5 * 1024 * 1024, // keep images size < 5 MB
  },
});

const personSchema = new mongoose.Schema({
  name: {
    type: "String",
    required: true,
  },
  emailId: {
    type: "String",
    required: true,
  },
  resumeUrl: {
    type: "String",
    required: true,
  },
});

const Person = new mongoose.model("Person", personSchema);

app.get("/", async (req, res) => {
  let persons;
  try {
    persons = await Person.find();
  } catch (err) {
    console.log("Error " + err.message);
  }

  res.status(200).json({ persons });
});

app.post("/", uploader.single("resume"), async (req, res) => {
  const storage = getStorage();
  const storageRef = ref(storage, req.file.originalname);
  let downloadUrl = "";
  uploadBytes(storageRef, req.file.buffer)
    .then((snapshot) => {
      console.log("Resume uploaded successfully");
    })
    .then(() => {
      getDownloadURL(storageRef).then(async (url) => {
        downloadUrl = url;

        const newPerson = new Person({
          name: req.body.name,
          emailId: req.body.emailId,
          resumeUrl: downloadUrl,
        });

        try {
          await newPerson.save();
        } catch (err) {
          console.log("Could not save user details " + err.message);
        }

        res.status(200).json(newPerson);

        try {
          let pdfParser = new PDFParser();
          var pdfPipe = request({ url: url, encoding: null }).pipe(pdfParser);
          pdfPipe.on("pdfParser_dataReady", (pdf) => {
            pdf.formImage.Pages[0].Texts.forEach((text) => {
              console.log(text.R[0].T);
            });
          });
        } catch (err) {
          console.log(err);
        }
      });
    });
});

mongoose
  .connect(process.env.MONGODB, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then(() => {
    console.log("Database connection established");
    app.listen(process.env.PORT || 5000, () => {
      console.log("Server is up and running on port 5000");
    });
  })
  .catch((err) => {
    console.log("An error occurred : " + err.message);
  });
