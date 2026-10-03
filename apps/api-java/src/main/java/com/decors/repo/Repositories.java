package com.decors.repo;

import com.decors.domain.*;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** All Spring Data repositories in one file; each is a thin typed door to one table. */
public final class Repositories {
  private Repositories() {}

  public interface ColorRepository extends JpaRepository<Color, Integer> {
    Optional<Color> findFirstByNameIgnoreCase(String name);

    @Query("select c from Color c where exists (select 1 from Product p where p.color = c) order by c.id")
    List<Color> findInUse();
  }

  public interface TagRepository extends JpaRepository<Tag, Integer> {
    Optional<Tag> findByName(String name);

    List<Tag> findByNameIn(Collection<String> names);

    @Query("select t from Tag t where exists (select 1 from Product p join p.tags pt where pt = t) order by t.name")
    List<Tag> findInUse();

  }

  public interface ProductRepository extends JpaRepository<Product, String>, JpaSpecificationExecutor<Product> {
    @Query("select max(p.price) from Product p")
    Integer maxPrice();

    @Query("select p.category, p.color.id, count(p) from Product p group by p.category, p.color.id")
    List<Object[]> countsByCategoryAndColor();

    @Query("select p from Product p join fetch p.color where p.id = :id")
    Optional<Product> findWithColor(@Param("id") String id);

    @Query("select p from Product p join fetch p.color where p.id in :ids")
    List<Product> findAllWithColor(@Param("ids") Collection<String> ids);

    @Query("select p from Product p join fetch p.color where p.id <> :id and (p.category = :category or p.color.id = :colorId) order by p.rating desc, p.id asc")
    List<Product> related(@Param("id") String id, @Param("category") Category category, @Param("colorId") Integer colorId,
        org.springframework.data.domain.Pageable page);

    @Query("select count(p) from Product p where p.color.id = :colorId")
    long countByColor(@Param("colorId") Integer colorId);
  }

  public interface ProductImageRepository extends JpaRepository<ProductImage, Integer> {
    List<ProductImage> findByProductIdOrderByPositionAscIdAsc(String productId);

    Optional<ProductImage> findByIdAndProductId(Integer id, String productId);

    long countByProductId(String productId);

    List<ProductImage> findByProductIdInOrderByPositionAscIdAsc(Collection<String> productIds);
  }

  public interface UserRepository extends JpaRepository<AppUser, String> {
    Optional<AppUser> findByEmail(String email);
  }

  public interface CartItemRepository extends JpaRepository<CartItem, CartLineId> {
    @Query("select c from CartItem c join fetch c.product p join fetch p.color where c.id.userId = :userId order by c.updatedAt asc")
    List<CartItem> findForUser(@Param("userId") String userId);

    @Query("select c from CartItem c where c.id.userId = :userId and c.id.productId in :ids")
    List<CartItem> findForUserAndProducts(@Param("userId") String userId, @Param("ids") Collection<String> ids);
  }

  public interface WishlistItemRepository extends JpaRepository<WishlistItem, CartItemId> {
    @Query("select w from WishlistItem w join fetch w.product p join fetch p.color where w.id.userId = :userId order by w.createdAt asc")
    List<WishlistItem> findForUser(@Param("userId") String userId);
  }

  public interface OrderRepository extends JpaRepository<ShopOrder, String> {
    Optional<ShopOrder> findByIdAndUserId(String id, String userId);

    Optional<ShopOrder> findByRazorpayOrderId(String razorpayOrderId);

    List<ShopOrder> findByUserIdOrderByCreatedAtDesc(String userId);
  }

  public interface OrderItemRepository extends JpaRepository<OrderItem, Integer> {
    List<OrderItem> findByOrderIdInOrderByIdAsc(Collection<String> orderIds);
  }

  public interface AuthTokenRepository extends JpaRepository<AuthToken, String> {
    Optional<AuthToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update AuthToken t set t.usedAt = :now where t.userId = :userId and t.type = :type and t.usedAt is null")
    int invalidateUnused(@Param("userId") String userId, @Param("type") AuthTokenType type, @Param("now") LocalDateTime now);

    @Modifying
    @Query("delete from AuthToken t where t.userId = :userId and t.expiresAt < :before")
    int deleteExpired(@Param("userId") String userId, @Param("before") LocalDateTime before);

    @Query("select max(t.createdAt) from AuthToken t where t.userId = :userId and t.type = :type")
    Optional<LocalDateTime> lastIssuedAt(@Param("userId") String userId, @Param("type") AuthTokenType type);
  }

  public interface ProductVariantRepository extends JpaRepository<ProductVariant, String> {
    List<ProductVariant> findByProductIdOrderByPositionAscIdAsc(String productId);

    List<ProductVariant> findByProductIdInOrderByPositionAscIdAsc(Collection<String> productIds);
  }
}
