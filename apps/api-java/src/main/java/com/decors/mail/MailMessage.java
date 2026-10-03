package com.decors.mail;

public record MailMessage(String to, String subject, String text, String html) {}
