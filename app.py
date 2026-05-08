# ═══════════════════════════════════════════════════════════════
#  AI DERMATOLOGIST BACKEND - STABILIZED FINAL VERSION
# ═══════════════════════════════════════════════════════════════

from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
import cv2
import os
import urllib.request

app = Flask(__name__)
CORS(app)

# --- 1. DEFINE CUSTOM FOCAL LOSS ---
@tf.keras.utils.register_keras_serializable()
class FocalLoss(tf.keras.losses.Loss):
    def __init__(self, gamma=2.0, alpha=0.25, **kwargs):
        super().__init__(**kwargs)
        self.gamma = gamma
        self.alpha = alpha

    def call(self, y_true, y_pred):
        y_pred = tf.clip_by_value(y_pred, 1e-7, 1.0 - 1e-7)
        cross_entropy = -y_true * tf.math.log(y_pred)
        weight = y_true * self.alpha * tf.pow(1 - y_pred, self.gamma)
        return tf.reduce_mean(tf.reduce_sum(weight * cross_entropy, axis=1))

    def get_config(self):
        config = super().get_config()
        config.update({"gamma": self.gamma, "alpha": self.alpha})
        return config

# --- 2. LOAD MODEL (Auto-download from Hugging Face if missing) ---
MODEL_PATH = "cnn_skin_disease_final.keras"
HF_URL = "https://huggingface.co/Ashzz1/cnn-skin-disease/resolve/main/cnn_skin_disease_final.keras"

if not os.path.exists(MODEL_PATH):
    print("📥 Downloading model from Hugging Face...")
    urllib.request.urlretrieve(HF_URL, MODEL_PATH)
    print("✅ Model downloaded!")

model = None
if os.path.exists(MODEL_PATH):
    print(f"🚀 Found {MODEL_PATH}. Attempting to load...")
    try:
        model = tf.keras.models.load_model(MODEL_PATH, custom_objects={'FocalLoss': FocalLoss})
        print("✅ Model loaded successfully!")
        print(f"--- MODEL INPUT SHAPE: {model.input_shape} ---")
    except Exception as e:
        print(f"❌ ERROR LOADING MODEL: {e}")
else:
    print(f"❌ CRITICAL ERROR: {MODEL_PATH} could not be downloaded or found.")

# ───────────────────────────────────────────────────────────────
# CLASS NAMES - ALIGNED TO HANDWRITTEN TEST RESULTS
# ───────────────────────────────────────────────────────────────
CLASS_NAMES = [
    'Melanoma',                  # Index 0
    'Melanocytic nevus',         # Index 1
    'Benign keratosis',          # Index 2
    'Actinic keratosis',         # Index 3
    'Vascular Lesion',           # Index 4
    'Squamous cell carcinoma',   # Index 5
    'Dermatofibroma',            # Index 6
    'Tinea Ringworm Candidiasis',# Index 7
    'Atopic Dermatitis',         # Index 8
    'unlabeled'                  # Index 9
]

# --- 4. PREDICTION LOGIC ---
@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({"status": "error", "message": "Model not loaded"})

    try:
        file = request.files['image']
        np_img = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        # Match EfficientNetB4 training resolution
        img = cv2.resize(img, (380, 380))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

        # Create batch and normalize
        img_array = np.expand_dims(img, axis=0).astype('float32')
        img_array = tf.keras.applications.efficientnet.preprocess_input(img_array)

        predictions = model.predict(img_array)
        class_idx = np.argmax(predictions)
        score = np.max(predictions)

        return jsonify({
            "status": "success",
            "condition": CLASS_NAMES[class_idx],
            "confidence": f"{score * 100:.1f}%"
        })
    except Exception as e:
        print(f"❌ Error: {e}")
        return jsonify({"status": "error", "message": str(e)})

if __name__ == '__main__':
    print("🌍 Server starting at http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=False)