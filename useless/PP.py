from paddleocr import PaddleOCR

def extract_text_ppstructure(image_path):
    ocr = PaddleOCR(
        use_angle_cls=True,
        lang='en',
        ocr_version='PP-OCRv3',
        use_gpu=False,
        det_db_box_thresh=0.3,
        structure_version='PP-StructureV2'
    )
    result = ocr.ocr(image_path)

    text = []
    for line in result[0]:
        text.append(line[1][0])
    return '\n'.join(text)

# Run on your image
text = extract_text_ppstructure('tst1.jpg')
print(text)
