from flask import Flask, request, jsonify
from flask_cors import CORS
import easyocr
from PIL import Image
from pdf2image import convert_from_bytes

app = Flask(__name__)
CORS(app)
reader = easyocr.Reader(['en'], gpu=False)

@app.route('/extract', methods=['POST'])
def extract():
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file'}), 400

    if file.filename.lower().endswith('.pdf'):
        pages = convert_from_bytes(file.read())
        text = ''
        for img in pages:
            text += ' '.join([t[1] for t in reader.readtext(img)]) + '\n'
    else:
        img = Image.open(file.stream).convert('RGB')
        text = ' '.join([t[1] for t in reader.readtext(img)])
    return jsonify({'text': text})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
