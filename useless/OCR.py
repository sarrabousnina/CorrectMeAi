
import easyocr

def extract_text(image_path):
    reader = easyocr.Reader(['en'])
    result = reader.readtext(image_path)
    text = ' '.join([item[1] for item in result])
    return text

# Test with an image

print(extract_text('C:/Users/user/Documents/CorrectMe/images/tst1.jpg'))