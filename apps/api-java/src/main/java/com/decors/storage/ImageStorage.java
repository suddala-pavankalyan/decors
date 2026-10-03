package com.decors.storage;

import com.decors.common.ApiException;
import com.decors.config.WebConfig;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Arrays;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Where uploaded images live. Local disk today; swap this class for S3/Cloudinary in production
 * (hosts with ephemeral disks lose local files on redeploy). Callers only see public paths.
 */
@Component
public class ImageStorage {
  public static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  private static final Logger log = LoggerFactory.getLogger(ImageStorage.class);
  private static final Pattern PATH = Pattern.compile("^/uploads/([0-9a-f-]{36}\\.(?:jpg|png|webp))$");
  private static final byte[] PNG_MAGIC = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};

  private final Path dir;

  public ImageStorage(WebConfig web) {
    this.dir = web.uploadDir();
  }

  /**
   * Decide the real image type from the file's first bytes. The client-supplied content type and filename are
   * ignored, so a script or SVG renamed to ".jpg" is rejected. Returns the extension, or null if not an image.
   */
  public static String detect(byte[] b) {
    if (b.length >= 3 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xd8 && (b[2] & 0xff) == 0xff) return "jpg";
    if (b.length >= 8 && Arrays.equals(Arrays.copyOf(b, 8), PNG_MAGIC)) return "png";
    if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
        && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') return "webp";
    return null;
  }

  /** Validates and stores the image, returning its public path ("/uploads/&lt;uuid&gt;.&lt;ext&gt;"). */
  public String save(byte[] bytes) {
    String ext = detect(bytes);
    if (ext == null) throw ApiException.unsupportedMedia("Only JPEG, PNG or WebP images are allowed");
    String name = UUID.randomUUID() + "." + ext;
    try {
      Files.createDirectories(dir);
      Files.write(dir.resolve(name), bytes, StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
    } catch (IOException e) {
      throw new IllegalStateException("Could not store the image: " + e.getMessage(), e);
    }
    return "/uploads/" + name;
  }

  /** Removes a stored file. Ignores external URLs and anything that isn't one of our generated names. */
  public void remove(String publicPath) {
    Matcher m = PATH.matcher(publicPath == null ? "" : publicPath);
    if (!m.matches()) return;
    try {
      Files.delete(dir.resolve(m.group(1)));
    } catch (NoSuchFileException ignored) {
      // already gone
    } catch (IOException e) {
      log.warn("Could not delete {}: {}", m.group(1), e.getMessage());
    }
  }
}
