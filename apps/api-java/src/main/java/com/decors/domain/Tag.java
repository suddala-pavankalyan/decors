package com.decors.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "Tag")
public class Tag {
  @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
  public Integer id;
  public String name;
}
