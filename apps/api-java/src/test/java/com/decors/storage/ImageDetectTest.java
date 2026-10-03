package com.decors.storage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class ImageDetectTest {
  @Test
  void recognisesRealImagesByTheirFirstBytes() {
    assertEquals("jpg", ImageStorage.detect(new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0}));
    assertEquals("png", ImageStorage.detect(new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0}));
    assertEquals("webp", ImageStorage.detect("RIFF \0\0\0WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1)));
  }

  @Test
  void rejectsEverythingElse() {
    assertNull(ImageStorage.detect("<svg onload=alert(1)>".getBytes(StandardCharsets.UTF_8)));
    assertNull(ImageStorage.detect("GIF89a".getBytes(StandardCharsets.UTF_8)));
    assertNull(ImageStorage.detect("RIFF\0\0\0\0WAVEfmt ".getBytes(StandardCharsets.ISO_8859_1)));
    assertNull(ImageStorage.detect(new byte[0]));
    assertNull(ImageStorage.detect(new byte[] {(byte) 0xff, (byte) 0xd8})); // too short to be a JPEG header
  }
}
